-- ============================================================================
-- MPSI CHALLENGE — MIGRATION 0014 : parrainage des équipes
-- À exécuter dans Dashboard Supabase → SQL Editor.
--
-- Principe (basé sur les vidéos de présentation de 0013) :
--   • Chaque MP/PSI visionne les présentations et SE PROPOSE comme parrain
--     des équipes qu'il souhaite (un vote par équipe, modifiable).
--   • Chaque équipe MPSI voit ses candidats et CHOISIT UN parrain
--     DÉFINITIF (validation en deux temps côté interface).
--   • Un MP/PSI ne peut être parrain que d'UNE équipe.
--   • Vidéos de présentation : aucune vérification (contrairement aux défis).
--
-- Tables/fonctions (écritures UNIQUEMENT via RPC security definer) :
--   godparent_offers            : propositions des MP/PSI
--   teams.godparent_student_id  : parrain choisi (définitif)
--   toggle_godparent_offer      : se proposer / se retirer (MP/PSI)
--   choose_godparent            : choix définitif (membres MPSI de l'équipe)
--   admin_reset_godparent       : réinitialisation (Super Admin uniquement)
-- Idempotent.
-- ============================================================================

-- 1) Colonnes parrain sur teams (+ un parrain = une équipe)
alter table public.teams
  add column if not exists godparent_student_id uuid
    references public.students(id) on delete set null,
  add column if not exists godparent_chosen_at timestamptz;

create unique index if not exists teams_one_godparent_uniq
  on public.teams (godparent_student_id)
  where godparent_student_id is not null;

-- 2) Propositions des MP/PSI
create table if not exists public.godparent_offers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, student_id)
);

alter table public.godparent_offers enable row level security;

-- Lecture : uniquement les comptes authentifiés (MP/PSI voit ses votes,
-- les équipes voient leurs candidats). Écriture via RPC uniquement.
drop policy if exists godparent_offers_select_authenticated on public.godparent_offers;
create policy godparent_offers_select_authenticated on public.godparent_offers
  for select to authenticated using (true);

-- 3) Se proposer / se retirer (compte MP/PSI actif uniquement)
create or replace function public.toggle_godparent_offer(p_team_id uuid, p_want boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
begin
  if auth.uid() is null then
    raise exception 'Connecte-toi d''abord.';
  end if;
  if p_team_id is null or not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'Équipe introuvable.';
  end if;

  -- L'auteur doit être un élève MP/PSI actif
  select s.id into v_me
  from public.students s
  join public.profiles p on p.student_id = s.id
  where p.auth_user_id = auth.uid()
    and s.active
    and s.track = 'mpsi2'
  order by s.created_at
  limit 1;
  if v_me is null then
    raise exception 'Seuls les comptes MP/PSI peuvent se proposer comme parrain.';
  end if;

  -- On ne peut pas se proposer pour sa propre équipe (compte fusionné)
  if exists (
    select 1 from public.team_members tm
    join public.profiles p on p.student_id = tm.student_id
    where p.auth_user_id = auth.uid()
      and tm.team_id = p_team_id
  ) then
    raise exception 'Tu fais déjà partie de cette équipe : impossible d''en être le parrain.';
  end if;

  if exists (
    select 1 from public.teams where id = p_team_id and godparent_student_id is not null
  ) then
    raise exception 'Cette équipe a déjà choisi son parrain.';
  end if;

  if coalesce(p_want, false) then
    insert into public.godparent_offers (team_id, student_id)
    values (p_team_id, v_me)
    on conflict (team_id, student_id) do nothing;
  else
    delete from public.godparent_offers
    where team_id = p_team_id and student_id = v_me;
  end if;
end $$;

-- 4) Choix DÉFINITIF du parrain (membres MPSI de l'équipe)
create or replace function public.choose_godparent(p_team_id uuid, p_mp_psi_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
begin
  if auth.uid() is null then
    raise exception 'Connecte-toi d''abord.';
  end if;

  -- L'auteur doit être un membre MPSI (actif) de cette équipe
  select s.id into v_me
  from public.students s
  join public.profiles p on p.student_id = s.id
  where p.auth_user_id = auth.uid()
    and s.active
    and s.track = 'mpsi'
    and exists (
      select 1 from public.team_members tm
      where tm.team_id = p_team_id and tm.student_id = s.id
    )
  order by s.created_at
  limit 1;
  if v_me is null then
    raise exception 'Seuls les membres MPSI de l''équipe peuvent choisir le parrain.';
  end if;

  if not exists (
    select 1 from public.teams
    where id = p_team_id and godparent_student_id is null
  ) then
    raise exception 'Cette équipe a déjà choisi son parrain (choix définitif).';
  end if;

  if not exists (
    select 1 from public.godparent_offers o
    join public.students s on s.id = o.student_id
    where o.team_id = p_team_id
      and o.student_id = p_mp_psi_id
      and s.active
      and s.track = 'mpsi2'
  ) then
    raise exception 'Ce MP/PSI ne s''est pas proposé pour cette équipe.';
  end if;

  if exists (
    select 1 from public.teams
    where godparent_student_id = p_mp_psi_id and id <> p_team_id
  ) then
    raise exception 'Ce MP/PSI est déjà parrain d''une autre équipe.';
  end if;

  update public.teams
  set godparent_student_id = p_mp_psi_id,
      godparent_chosen_at = now()
  where id = p_team_id;

  -- Le parrain est pris : il ne peut plus se proposer ailleurs
  delete from public.godparent_offers
  where student_id = p_mp_psi_id and team_id <> p_team_id;
end $$;

-- 5) Réinitialisation (Super Admin uniquement)
create or replace function public.admin_reset_godparent(p_team_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Réservé au Super Admin.';
  end if;
  update public.teams
  set godparent_student_id = null,
      godparent_chosen_at = null
  where id = p_team_id;
end $$;
