-- ============================================================================
-- MPSI CHALLENGE — MIGRATION 0003 : nettoyage démo + accès vidéos par filière
-- À exécuter dans Dashboard Supabase → SQL Editor (idempotent).
--
--   1) Supprime les équipes/élèves/scores de démonstration (les défis aussi)
--   2) Réinitialise les 15 cases
--   3) Vidéos : MP/PSI peut VOIR toutes les vidéos ; MPSI ne peut voir que
--      celles de SA propre équipe. L'upload reste réservé aux MPSI.
--   4) Supprime la liaison identité-par-appareil (devenu inutile : les comptes
--      élèves fonctionnent depuis n'importe quel appareil via leur session).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Suppression des données de démonstration
-- ---------------------------------------------------------------------------
delete from public.point_transactions
where reason like '%démo%' or reason like '%demo%';

delete from public.team_members
where student_id in (select id from public.students where password_hash is null);

delete from public.team_slots;
insert into public.team_slots (slot_number)
select g from generate_series(1, 15) g
on conflict (slot_number) do nothing;

delete from public.teams
where id in (select team_id from public.team_slots where team_id is not null);

delete from public.students where password_hash is null;

delete from public.challenges;

-- ---------------------------------------------------------------------------
-- 1bis) Suppression de la liaison identité-par-appareil
--   Les élèves se connectent maintenant avec (filière, prénom, nom, mot de
--   passe) depuis n'importe quel appareil : la colonne anon_user_id et le RPC
--   claim_or_create_student ne servent plus.
-- ---------------------------------------------------------------------------
drop function if exists public.claim_or_create_student(text);

alter table public.students
  drop column if exists anon_user_id;

-- ---------------------------------------------------------------------------
-- 2) Accès vidéos par filière
--    - MP/PSI : peut lire toutes les vidéos (spectateur)
--    - MPSI   : peut lire UNIQUEMENT les vidéos de sa propre équipe
--    - Admin  : tout (policy existante)
-- ---------------------------------------------------------------------------

-- Visionner : un MPSI voit sa propre équipe, un MP/PSI voit tout, un admin voit tout
drop policy if exists "submissions video read" on storage.objects;
create policy "submissions video read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'challenge-submissions'
    and (
      public.is_admin()
      or public.my_track() = 'mpsi2'
      or (public.my_track() = 'mpsi'
          and (storage.foldername(name))[1] = public.my_team_id()::text)
    )
  );

-- Les soumissions (métadonnées) restent lisibles par tous les authentifiés :
-- le classement / historique en ont besoin, mais seules les vidéos ci-dessus
-- sont réellement consultables.

-- Rappel upload : MPSI uniquement, dans le dossier de SA propre équipe
-- (policy "submissions video upload" de la migration 0002, inchangée).
