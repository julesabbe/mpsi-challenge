-- ============================================================================
-- MPSI CHALLENGE — MIGRATION 0011 : fusion des identités
-- À exécuter dans Dashboard Supabase → SQL Editor.
--
-- But : UNE même personne (le Super Admin, mais aussi n'importe quel élève)
-- peut utiliser UN SEUL compte de connexion pour être, au choix :
--   • Super Admin (compte e-mail réel)
--   • élève MPSI
--   • élève MP/PSI
-- Le bug « duplicate key value violates unique constraint
-- "users_email_partial_key" » disparaît : plus aucun doublon d'e-mail
-- technique n'est créé (les comptes sont réutilisés, jamais dupliqués).
--
-- Changements :
--   1) profiles : un compte auth peut avoir PLUSIEURS profils (admin + un
--      profil par filière) → suppression de l'unicité sur auth_user_id.
--   2) Purge des comptes techniques orphelins (@students.internal sans élève
--      lié) qui provoquaient le doublon.
--   3) student_signup : e-mail technique PAR PERSONNE (md5 prénom.nom, sans
--      la filière). Si la personne existe déjà (même prénom + nom dans une
--      autre filière), on RÉUTILISE son compte auth (même mot de passe
--      exigé) au lieu d'en créer un second.
--   4) student_login : renvoie l'e-mail réel du compte auth lié au profil
--      (l'e-mail du Super Admin pour ses identités fusionnées).
--   5) Nouvelle fonction link_current_student : relie un profil élève au
--      compte auth de la session COURANTE (aucun nouvel e-mail créé).
-- Idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Un compte auth = plusieurs profils (admin + élève(s))
-- ---------------------------------------------------------------------------
do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'u'
    and array_length(conkey, 1) = 1
    and conkey[1] = (
      select attnum from pg_attribute
      where attrelid = 'public.profiles'::regclass
        and attname = 'auth_user_id'
    );
  if c is not null then
    execute format('alter table public.profiles drop constraint %I', c);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Purge des comptes techniques orphelins (aucun élève lié)
-- ---------------------------------------------------------------------------
delete from auth.users u
where u.email like '%@students.internal'
  and not exists (
    select 1 from public.profiles p
    where p.auth_user_id = u.id
      and p.student_id is not null
  );

-- ---------------------------------------------------------------------------
-- 3) Inscription : réutilise le compte de la personne si elle existe déjà
-- ---------------------------------------------------------------------------
create or replace function public.student_signup(
  p_track text, p_first_name text, p_last_name text, p_password text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_track  text := nullif(btrim(p_track), '');
  v_first  text := nullif(btrim(p_first_name), '');
  v_last   text := nullif(btrim(coalesce(p_last_name, '')), '');
  v_pass   text := p_password;
  v_email  text;
  v_uid    uuid;
  v_hash   text;
  v_student uuid;
  v_created bool := false;
begin
  if v_track not in ('mpsi','mpsi2') then
    raise exception 'Choisis ta filière : MPSI ou MP/PSI.';
  end if;
  if v_first is null or length(v_first) < 2 or length(v_first) > 40
     or v_first !~ '^[A-Za-zÀ-ÖØ-öø-ÿ'' -]+$' then
    raise exception 'Prénom invalide (lettres uniquement, 2 à 40 caractères).';
  end if;
  if v_last is null or length(v_last) < 2 or length(v_last) > 40
     or v_last !~ '^[A-Za-zÀ-ÖØ-öø-ÿ'' -]+$' then
    raise exception 'Nom invalide (lettres uniquement, 2 à 40 caractères).';
  end if;
  if v_pass is null or length(v_pass) < 4 then
    raise exception 'Le mot de passe doit contenir au moins 4 caractères.';
  end if;

  -- Unicité par nom de famille ET filière
  if exists (
    select 1 from public.students
    where track = v_track
      and lower(coalesce(last_name, '')) = lower(v_last)
  ) then
    raise exception 'Ce nom de famille est déjà inscrit en %.',
      case when v_track = 'mpsi' then 'MPSI' else 'MP/PSI' end;
  end if;

  -- E-mail technique PAR PERSONNE (indépendant de la filière)
  v_email := md5(lower(v_first || '.' || v_last)) || '@students.internal';

  select id, encrypted_password into v_uid, v_hash
  from auth.users where email = v_email;

  if v_uid is null then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
      'authenticated', 'authenticated',
      v_email, crypt(v_pass, gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    )
    returning id into v_uid;
    v_created := true;
  elsif v_hash is null or v_hash <> crypt(v_pass, v_hash) then
    raise exception 'Ce prénom + nom correspond déjà à un compte (dans une autre filière) avec un mot de passe différent. Utilise le même mot de passe ou connecte-toi.';
  end if;

  insert into public.students (first_name, last_name, track, password_hash)
  values (v_first, v_last, v_track, crypt(v_pass, gen_salt('bf')))
  returning id into v_student;

  if v_created then
    -- Le trigger on_auth_user_created a déjà créé le profil : on le lie
    update public.profiles
    set student_id = v_student
    where auth_user_id = v_uid;
  else
    -- Personne déjà connue : on ajoute un profil pour cette filière
    insert into public.profiles (auth_user_id, student_id)
    values (v_uid, v_student);
  end if;

  return v_student;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Connexion : e-mail du compte auth réellement lié à l'élève
-- ---------------------------------------------------------------------------
create or replace function public.student_login(
  p_track text, p_first_name text, p_last_name text, p_password text
) returns text
language sql stable security definer set search_path = public, extensions as $$
  select u.email
  from public.students s
  join public.profiles p on p.student_id = s.id
  join auth.users u on u.id = p.auth_user_id
  where s.track = nullif(btrim(p_track), '')
    and lower(s.first_name) = lower(nullif(btrim(p_first_name), ''))
    and lower(coalesce(s.last_name, '')) = lower(nullif(btrim(coalesce(p_last_name, '')), ''))
    and s.password_hash = crypt(p_password, s.password_hash)
    and s.active
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 5) Relier un profil élève au compte connecté (aucun nouvel e-mail)
-- ---------------------------------------------------------------------------
create or replace function public.link_current_student(
  p_track text, p_first_name text, p_last_name text, p_password text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_track   text := nullif(btrim(p_track), '');
  v_first   text := nullif(btrim(p_first_name), '');
  v_last    text := nullif(btrim(coalesce(p_last_name, '')), '');
  v_pass    text := p_password;
  v_hash    text;
  v_student uuid;
begin
  if auth.uid() is null then
    raise exception 'Connecte-toi d''abord.';
  end if;
  if v_track not in ('mpsi','mpsi2') then
    raise exception 'Choisis ta filière : MPSI ou MP/PSI.';
  end if;
  if v_first is null or length(v_first) < 2 or length(v_first) > 40
     or v_first !~ '^[A-Za-zÀ-ÖØ-öø-ÿ'' -]+$' then
    raise exception 'Prénom invalide (lettres uniquement, 2 à 40 caractères).';
  end if;
  if v_last is null or length(v_last) < 2 or length(v_last) > 40
     or v_last !~ '^[A-Za-zÀ-ÖØ-öø-ÿ'' -]+$' then
    raise exception 'Nom invalide (lettres uniquement, 2 à 40 caractères).';
  end if;
  if v_pass is null or length(v_pass) < 4 then
    raise exception 'Le mot de passe doit contenir au moins 4 caractères.';
  end if;

  -- Unicité par nom de famille ET filière
  if exists (
    select 1 from public.students
    where track = v_track
      and lower(coalesce(last_name, '')) = lower(v_last)
  ) then
    raise exception 'Ce nom de famille est déjà inscrit en %.',
      case when v_track = 'mpsi' then 'MPSI' else 'MP/PSI' end;
  end if;

  -- Le mot de passe doit être celui du compte connecté (réutilisation)
  select encrypted_password into v_hash from auth.users where id = auth.uid();
  if v_hash is null or v_hash <> crypt(v_pass, v_hash) then
    raise exception 'Utilise le mot de passe de ton compte (celui que tu utilises pour te connecter).';
  end if;

  insert into public.students (first_name, last_name, track, password_hash)
  values (v_first, v_last, v_track, crypt(v_pass, gen_salt('bf')))
  returning id into v_student;

  insert into public.profiles (auth_user_id, student_id)
  values (auth.uid(), v_student);

  return v_student;
end $$;
