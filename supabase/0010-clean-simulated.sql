-- ============================================================================
-- MPSI CHALLENGE — MIGRATION 0010 : base remise à zéro (aucun contenu simulé)
-- À exécuter dans Dashboard Supabase → SQL Editor.
--
-- Supprime TOUT le contenu de la compétition pour repartir d'une base
-- 100 % propre et prête pour le déploiement :
--   • défis, équipes, soumissions, transactions, notifications, vidéos
--   • élèves (et leurs comptes techniques d'authentification)
-- La liste des défis et la liste des élèves redeviennent VIDE.
--
-- Ce qui est CONSERVÉ :
--   • le compte Super Admin (julesabbe0307@gmail.com) + son rôle admin
--   • les 15 cases d'équipes (vides et prêtes)
--   • toutes les tables, fonctions et politiques (schéma intact)
--
-- Idempotent : exécutable plusieurs fois sans risque.
-- ============================================================================

-- 1) Activité (soumissions, points, notifications, membres)
delete from public.point_transactions;
delete from public.submissions;
delete from public.notifications;
delete from public.team_members;

-- 2) Vidéos téléversées (preuves)
delete from storage.objects where bucket_id = 'challenge-submissions';

-- 3) Équipes + libération des 15 cases
update public.team_slots set team_id = null, created_by = null;
delete from public.teams;

-- 4) Défis (aucun défi pré-créé : tout se crée via /admin/challenges)
delete from public.challenges;

-- 5) Élèves + leurs comptes d'authentification techniques
--    (le profil du Super Admin — sans élève lié — est préservé)
do $$
declare
  v_auth uuid[];
begin
  select array_agg(p.auth_user_id) into v_auth
  from public.profiles p
  where p.student_id is not null
    and exists (
      select 1 from auth.users u
      where u.id = p.auth_user_id
        and lower(coalesce(u.email, '')) <> 'julesabbe0307@gmail.com'
    );

  delete from public.students;

  if v_auth is not null then
    delete from auth.users where id = any(v_auth);
  end if;
end $$;

-- 6) Vérification finale
select
  (select count(*) from public.students)   as eleves,
  (select count(*) from public.challenges) as defis,
  (select count(*) from public.teams)      as equipes,
  (select count(*) from public.team_slots
    where team_id is not null)             as cases_occupees;
