-- ============================================================================
-- MPSI CHALLENGE — MIGRATION 0002 : comptes élèves par mot de passe (sans
-- e-mail), filière MPSI / MP-PSI, et 15 cases d'équipes préparées.
-- À exécuter dans Dashboard Supabase → SQL Editor (idempotent).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Schéma : filière + mot de passe sur students ; cases d'équipes
-- ---------------------------------------------------------------------------
alter table public.students
  add column if not exists track text not null default 'mpsi'
    check (track in ('mpsi','mpsi2')),
  add column if not exists password_hash text;

-- (Pas de liaison identité-par-appareil : les comptes élèves fonctionnent
-- depuis n'importe quel appareil via leur session.)

-- Une identité élève = (track, prénom, nom) insensible à la casse
create unique index if not exists students_identity_uniq
  on public.students (track, lower(first_name), lower(coalesce(last_name,'')));

-- 15 cases d'équipes préparées : slots (aucune équipe réelle tant que vide)
create table if not exists public.team_slots (
  slot_number int primary key check (slot_number between 1 and 15),
  team_id uuid references public.teams(id) on delete set null,
  created_by uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.team_slots (slot_number)
select g from generate_series(1, 15) g
on conflict (slot_number) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Inscription / connexion élève (prénom + nom + mot de passe, SANS e-mail)
--    On dérive un e-mail technique unique par élève dans auth.users
--    (invisible pour l'élève), et on stocke le hash bcrypt.
-- ---------------------------------------------------------------------------

-- Inscription : crée l'élève + un compte auth.users dédié, puis connecte.
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
  if auth.uid() is not null then
    raise exception 'Une session est déjà active sur cet appareil. Déconnecte-toi d''abord.';
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

-- Connexion : (track, prénom, nom, mot de passe) → session auth
create or replace function public.student_login(
  p_track text, p_first_name text, p_last_name text, p_password text
) returns text  -- renvoie l'e-mail technique à passer à signInWithPassword
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
-- 3) Identité courante : par compte auth (profiles.student_id) — l'ancien
--    lien par appareil anonyme reste supporté pour l'admin existant.
-- ---------------------------------------------------------------------------
create or replace function public.my_student_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select p.student_id from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.student_id is not null
    and exists (select 1 from public.students s where s.id = p.student_id and s.active)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 4) Équipes par cases : réserver une case vide (1–15) avec 3 membres
-- ---------------------------------------------------------------------------
create or replace function public.claim_team_slot(
  p_slot int, p_team_name text, p_emoji text,
  p_member2 uuid, p_member3 uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.my_student_id();
  v_track text;
  v_team uuid;
begin
  if v_me is null then
    raise exception 'Connecte-toi d''abord.';
  end if;
  select track into v_track from public.students where id = v_me;
  if v_track <> 'mpsi' then
    raise exception 'Seuls les élèves MPSI peuvent créer une équipe.';
  end if;
  if p_slot is null or p_slot < 1 or p_slot > 15 then
    raise exception 'Case invalide (1 à 15).';
  end if;
  if exists (select 1 from public.team_members where student_id = v_me) then
    raise exception 'Tu fais déjà partie d''une équipe.';
  end if;

  p_team_name := nullif(btrim(p_team_name), '');
  if p_team_name is null or length(p_team_name) < 2 or length(p_team_name) > 40 then
    raise exception 'Le nom de l''équipe doit contenir entre 2 et 40 caractères.';
  end if;
  if p_member2 is null or p_member3 is null or p_member2 = p_member3
     or p_member2 = v_me or p_member3 = v_me then
    raise exception 'Sélectionne 2 coéquipiers distincts (toi inclus).';
  end if;
  if exists (
    select 1 from public.students
    where id in (v_me, p_member2, p_member3) and track <> 'mpsi'
  ) then
    raise exception 'Tous les membres doivent être en MPSI.';
  end if;
  if exists (
    select 1 from public.team_members where student_id in (p_member2, p_member3)
  ) then
    raise exception 'Un des élèves sélectionnés a déjà une équipe.';
  end if;

  -- Réservation atomique de la case
  update public.team_slots
  set team_id = null, created_by = v_me  -- placeholder, remplacé juste après
  where slot_number = p_slot and team_id is null;
  if not found then
    raise exception 'Cette case est déjà prise.';
  end if;

  insert into public.teams (name, emoji)
  values (p_team_name, coalesce(nullif(btrim(p_emoji), ''), '⚡'))
  returning id into v_team;

  insert into public.team_members (team_id, student_id)
  values (v_team, v_me), (v_team, p_member2), (v_team, p_member3);

  update public.team_slots
  set team_id = v_team, created_by = v_me
  where slot_number = p_slot;

  return v_team;
exception
  when others then
    -- Libère la case si la création a échoué après réservation
    update public.team_slots set team_id = null, created_by = null
    where slot_number = p_slot and team_id is not null
      and not exists (select 1 from public.teams t where t.id = team_id);
    raise;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Restrictions MP/PSI : lecture seule partout (RLS)
--    Le compte MP/PSI a une identité mais ne peut rien écrire.
-- ---------------------------------------------------------------------------

-- Lecture : tous les comptes authentifiés lisent (déjà en place).
-- Écritures élèves : uniquement MPSI. On remplace les policies d'insert de
-- submissions pour exiger une équipe MPSI (l'équipe est forcément MPSI par
-- construction, mais on verrouile aussi côté Storage).

-- Identité élève courante, exposée pour les policies
create or replace function public.my_track()
returns text language sql stable security definer set search_path = public as $$
  select s.track from public.students s
  where s.id = public.my_student_id();
$$;

drop policy if exists "submissions insert own team" on public.submissions;
create policy "submissions insert own team"
  for insert to authenticated with check (
    team_id = public.my_team_id()
    and submitted_by = public.my_student_id()
    and public.my_track() = 'mpsi'
  );

-- Vidéos : upload uniquement par un MPSI, dans le dossier de SA propre équipe
drop policy if exists "submissions video upload" on storage.objects;
create policy "submissions video upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'challenge-submissions'
    and public.my_track() = 'mpsi'
    and (storage.foldername(name))[1] = public.my_team_id()::text
  );

-- teams/students : toujours admin-only en écriture (déjà le cas) ;
-- l'élève ne crée plus d'équipe en direct, seulement via claim_team_slot.
