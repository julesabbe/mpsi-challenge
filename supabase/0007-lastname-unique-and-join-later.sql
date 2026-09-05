-- ============================================================================
-- MPSI CHALLENGE — MIGRATION 0007 : unicité par NOM DE FAMILLE uniquement
-- À exécuter dans Dashboard Supabase → SQL Editor.
--
-- Règle : deux élèves peuvent avoir le même PRÉNOM (Jules Abbe + Jules
-- Martin). La contrainte d'unicité ne porte que sur le NOM DE FAMILLE,
-- dans la même filière.
--
--   - Supprime les anciens index d'unicité (prénom seul, prénom+nom,
--     filière+prénom+nom)
--   - Crée l'index unique (track, lower(last_name))
--   - Met à jour student_signup : le doublon est refusé si le nom de
--     famille existe déjà dans la filière
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Anciens index d'unicité (remplacés)
-- ---------------------------------------------------------------------------
drop index if exists public.students_first_name_uniq;
drop index if exists public.students_name_uniq;
drop index if exists public.students_identity_uniq;

-- ---------------------------------------------------------------------------
-- 2) Nouvelle règle : un seul élève par NOM DE FAMILLE et par filière
-- ---------------------------------------------------------------------------
create unique index if not exists students_track_lastname_uniq
  on public.students (track, lower(coalesce(last_name, '')));

-- ---------------------------------------------------------------------------
-- 3) student_signup — contrôle de doublon sur le nom de famille uniquement
-- ---------------------------------------------------------------------------
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

  -- Doublon : même NOM DE FAMILLE dans la même filière
  select id into v_exists from public.students
  where track = v_track
    and lower(coalesce(last_name,'')) = lower(v_last);
  if v_exists is not null then
    raise exception 'Ce nom de famille est déjà inscrit en %.',
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

-- ✅ Vérification :
-- select indexname from pg_indexes where tablename = 'students'
--   and indexname like '%uniq%';