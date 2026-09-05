-- ============================================================================
-- MPSI CHALLENGE — MIGRATION 0009 : 15 cases d'équipes garanties + RLS
-- À exécuter dans Dashboard Supabase → SQL Editor.
--
-- Problème constaté : la table team_slots est VIDE (la page « Les 15 équipes »
-- n'affiche donc aucune case) et elle a été créée sans RLS en 0002
-- (n'importe qui pouvait l'écrire via l'API REST). Ce patch :
--   1) recrée la table si elle n'existe pas (schéma identique à 0002),
--   2) insère les cases manquantes 1 à 15 SANS toucher aux cases occupées
--      (aucun DELETE : les équipes déjà en place sont préservées),
--   3) active RLS et n'autorise que la LECTURE — l'écriture passe
--      exclusivement par la fonction claim_team_slot (security definer,
--      qui contourne RLS), déjà utilisée par la page /teams.
-- Idempotent : exécutable plusieurs fois sans risque.
-- ============================================================================

-- 1) Table (recréée si absente)
create table if not exists public.team_slots (
  slot_number int primary key check (slot_number between 1 and 15),
  team_id uuid references public.teams(id) on delete set null,
  created_by uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 2) Cases manquantes uniquement (on conflict = les cases existantes,
--    occupées ou non, sont conservées telles quelles)
insert into public.team_slots (slot_number)
select g from generate_series(1, 15) g
on conflict (slot_number) do nothing;

-- 3) RLS : lecture pour tout le monde (numéro + équipe = info publique),
--    aucune écriture directe — seul claim_team_slot peut réserver une case.
alter table public.team_slots enable row level security;

drop policy if exists team_slots_select_all on public.team_slots;
create policy team_slots_select_all on public.team_slots
  for select
  to anon, authenticated
  using (true);