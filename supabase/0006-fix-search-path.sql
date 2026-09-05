-- ============================================================================
-- MPSI CHALLENGE — PATCH 0006 : search_path et pgcrypto
-- À exécuter dans Dashboard Supabase → SQL Editor.
--
-- Problème : pgcrypto est installé dans le schéma « extensions » (standard
-- Supabase), mais les fonctions déclaraient « set search_path = public » —
-- gen_salt()/crypt() étaient donc introuvables à l'exécution
-- (« function gen_salt(unknown) does not exist »).
--
-- Correctif : search_path = public, extensions.
-- ============================================================================

-- Inscription : crée l'élève + le compte auth, lie le profil créé par trigger
create or replace function public.student_signup(
  p_track text, p_first_name text, p_last_name text, p_password text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_track text := nullif(btrim(p_track), '');
  v_first text := nullif(btrim(p_first_name), '');
  v_last  text := nullif(btrim(coalesce(p_last_name, '')), '');
  v_pass  text := p_password;
  v_email text;
  v_uid uuid;
  v_student uuid;
  v_exists uuid;
begin
  if exists (
    select 1 from public.profiles p
    join public.students s on s.id = p.student_id and s.active
    where p.auth_user_id = auth.uid()
  ) then
    raise exception 'Une session avec une identité élève est déjà active. Déconnecte-toi d''abord.';
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

  select id into v_exists from public.students
  where track = v_track
    and lower(first_name) = lower(v_first)
    and lower(coalesce(last_name,'')) = lower(v_last);
  if v_exists is not null then
    raise exception 'Ce prénom/nom est déjà inscrit en %.',
      case when v_track = 'mpsi' then 'MPSI' else 'MP/PSI' end;
  end if;

  v_email := v_track || '.' || md5(lower(v_first || '.' || v_last))
             || '@students.internal';

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

  insert into public.students (first_name, last_name, track, password_hash)
  values (v_first, v_last, v_track, crypt(v_pass, gen_salt('bf')))
  returning id into v_student;

  update public.profiles
  set student_id = v_student
  where auth_user_id = v_uid;

  return v_student;
end $$;

-- Connexion : (filière, prénom, nom, mot de passe) → e-mail technique
create or replace function public.student_login(
  p_track text, p_first_name text, p_last_name text, p_password text
) returns text
language sql stable security definer set search_path = public, extensions as $$
  select s.track || '.' || md5(lower(s.first_name || '.' || coalesce(s.last_name,'')))
         || '@students.internal'
  from public.students s
  where s.track = nullif(btrim(p_track), '')
    and lower(s.first_name) = lower(nullif(btrim(p_first_name), ''))
    and lower(coalesce(s.last_name,'')) = lower(nullif(btrim(coalesce(p_last_name,'')), ''))
    and s.password_hash = crypt(p_password, s.password_hash)
    and s.active;
$$;
