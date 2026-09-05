-- ============================================================================
-- MPSI CHALLENGE — MIGRATION 0005 : remise à zéro complète + signup fonctionnel
-- À exécuter dans Dashboard Supabase → SQL Editor (idempotent).
--
--   1) Active pgcrypto (nécessaire à crypt()/gen_salt)
--   2) Purge les équipes de démo (toute équipe sans membre) + orphelins
--   3) Répare student_signup : compatible avec le trigger handle_new_user
--      (qui crée déjà le profil — on ne l'insère plus une 2e fois)
--   4) Ouvre la LECTURE publique (anon) du classement/défis/équipes :
--      la page d'accueil doit s'afficher pour un visiteur non connecté
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) pgcrypto
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 2) Purge : équipes de démo, liens orphelins, comptes techniques abandonnés
-- ---------------------------------------------------------------------------
-- Toute équipe sans membre est un résidu de démo (les vraies équipes ont 3
-- membres ; les suppressions cascade sur members/submissions/transactions).
delete from public.teams t
where not exists (
  select 1 from public.team_members m where m.team_id = t.id
);

-- Élèves fantômes (sans mot de passe = jamais inscrits réellement)
delete from public.students where password_hash is null;

-- Comptes techniques @students.internal sans élève lié (inscriptions échouées)
delete from auth.users u
where u.email like '%@students.internal'
  and not exists (
    select 1 from public.profiles p
    where p.auth_user_id = u.id and p.student_id is not null
  );

-- Élèves sans aucun compte auth lié (résidus d'inscriptions cassées)
delete from public.students s
where not exists (
  select 1 from public.profiles p where p.student_id = s.id
);

-- 15 cases toutes libres
delete from public.team_slots;
insert into public.team_slots (slot_number)
select g from generate_series(1, 15) g
on conflict (slot_number) do nothing;

-- ---------------------------------------------------------------------------
-- 3) student_signup — version finale
--    Le trigger on_auth_user_created (migration 0001) crée DÉJÀ une ligne
--    profiles pour chaque nouvel utilisateur auth : on ne doit PAS en
--    insérer une seconde (contrainte unique sur profiles.auth_user_id).
--    On insère l'élève PUIS on lie le profil existant.
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
  -- Refuse seulement si la session a déjà une identité élève (le Super Admin
  -- sans identité élève peut inscrire depuis son navigateur).
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

  -- e-mail technique (jamais montré à l'élève) : filière + md5 du nom
  v_email := v_track || '.' || md5(lower(v_first || '.' || v_last))
             || '@students.internal';

  -- Compte auth dédié, confirmé directement (pas d'e-mail à valider).
  -- Le trigger handle_new_user crée automatiquement le profil associé.
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

  -- Lie le profil créé par le trigger à l'élève (pas de double insertion)
  update public.profiles
  set student_id = v_student
  where auth_user_id = v_uid;

  return v_student;
end $$;

-- Connexion : (filière, prénom, nom, mot de passe) → e-mail technique
create or replace function public.student_login(
  p_track text, p_first_name text, p_last_name text, p_password text
) returns text
language sql stable security definer set search_path = public as $$
  select s.track || '.' || md5(lower(s.first_name || '.' || coalesce(s.last_name,'')))
         || '@students.internal'
  from public.students s
  where s.track = nullif(btrim(p_track), '')
    and lower(s.first_name) = lower(nullif(btrim(p_first_name), ''))
    and lower(coalesce(s.last_name,'')) = lower(nullif(btrim(coalesce(p_last_name,'')), ''))
    and s.password_hash = crypt(p_password, s.password_hash)
    and s.active;
$$;

-- ---------------------------------------------------------------------------
-- 4) Lecture publique de la vitrine (classement, défis, équipes)
--    La page d'accueil s'affiche pour un visiteur NON connecté.
--    Écritures : inchangées (admin / RPC pour les élèves MPSI).
--    Les VIDÉOS restent strictement réservées aux sessions connectées.
-- ---------------------------------------------------------------------------
drop policy if exists "teams public read" on public.teams;
create policy "teams public read" on public.teams for select using (true);

drop policy if exists "team_members public read" on public.team_members;
create policy "team_members public read" on public.team_members for select using (true);

drop policy if exists "students public read" on public.students;
create policy "students public read" on public.students for select using (true);

drop policy if exists "challenges public read" on public.challenges;
create policy "challenges public read" on public.challenges for select using (true);

drop policy if exists "point_transactions public read" on public.point_transactions;
create policy "point_transactions public read" on public.point_transactions for select using (true);

drop policy if exists "submissions public read" on public.submissions;
create policy "submissions public read" on public.submissions for select using (true);

-- ✅ Vérification :
-- select (select count(*) from public.teams) as equipes,
--        (select count(*) from public.students) as eleves,
--        (select count(*) from public.team_slots where team_id is null) as cases_libres;
