-- ============================================================================
-- MPSI CHALLENGE — PATCH 0004 : répare student_signup
-- À exécuter dans Dashboard Supabase → SQL Editor.
--
-- Problème : la version de student_signup actuellement en base refuse toute
-- inscription avec « Un élève avec cette identité existe déjà » alors que la
-- table students est vide. Une variante obsolète a été exécutée, et elle a
-- créé des comptes techniques orphelins dans auth.users qui polluent
-- désormais chaque nouvelle tentative.
--
-- Ce patch :
--   1) Supprime les comptes techniques orphelins (@students.internal)
--      qui n'ont aucun profil/student associé
--   2) Remplace student_signup par la version correcte
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Nettoyage des orphelins : comptes @students.internal sans élève lié
-- ---------------------------------------------------------------------------
delete from auth.users
where email like '%@students.internal'
  and id not in (select coalesce(auth_user_id, '00000000-0000-0000-0000-000000000000')
                 from public.profiles);

-- ---------------------------------------------------------------------------
-- 2) student_signup — version correcte et complète
-- ---------------------------------------------------------------------------
create or replace function public.student_signup(
  p_track text, p_first_name text, p_last_name text, p_password text
) returns uuid
language plpgsql security definer set search_path = public as $$
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
  -- Un compte auth est toléré s'il n'a PAS d'identité élève (ex. Super Admin) ;
  -- on refuse seulement si l'appareil a déjà une identité élève active.
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
    raise exception 'Ce prénom/nom est déjà inscrit en %.', case when v_track='mpsi' then 'MPSI' else 'MP/PSI' end;
  end if;

  -- e-mail technique (jamais montré à l'élève) : préfixe + md5 du nom
  v_email := v_track || '.' || md5(lower(v_first || '.' || v_last))
             || '@students.internal';

  -- Compte auth dédié, confirmé directement (pas d'e-mail à valider)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    v_email, crypt(v_pass, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  )
  returning id into v_uid;

  insert into public.students (first_name, last_name, track, password_hash)
  values (v_first, v_last, v_track, crypt(v_pass, gen_salt('bf')))
  returning id into v_student;

  insert into public.profiles (auth_user_id, student_id, role)
  values (v_uid, v_student, 'user');

  return v_student;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Vérification (doit afficher le nom de la fonction et aucune erreur)
-- ---------------------------------------------------------------------------
select proname from pg_proc where proname = 'student_signup';
