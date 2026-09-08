-- ============================================================================
-- MPSI CHALLENGE — PATCH 0016 : nettoyage des comptes et de l'équipe de test
-- À exécuter UNE FOIS dans Supabase → SQL Editor.
--
-- Supprime :
--   1) l'équipe de test "Équipe Test" (et ses liens team_members),
--   2) les 3 comptes élèves de test : Testbuff Alphanine, Testbeta Beta,
--      Testgamma Gamma,
--   3) leurs comptes techniques auth (e-mail @students.internal) + profils,
--   4) libère la case attribuée (team_slots.team_id → null).
--
-- Conserve TOUT le reste : les vrais élèves, les défis, les autres équipes et
-- le compte Super Admin. Idempotent : ne touche rien si rien ne correspond.
-- ============================================================================

begin;

-- 1) Capture les UID auth des comptes de test AVANT de supprimer les élèves
--    (profil lié via profiles.student_id).
create temp table if not exists tmp_test_auth on commit drop as
select p.auth_user_id
from public.profiles p
join public.students s on s.id = p.student_id
where s.first_name in ('Testbuff', 'Testbeta', 'Testgamma');

-- 2) Supprime l'équipe de test (team_members part en cascade).
delete from public.teams
where name = 'Équipe Test'
   or id in (
     select tm.team_id
     from public.team_members tm
     join public.students s on s.id = tm.student_id
     where s.first_name in ('Testbuff', 'Testbeta', 'Testgamma')
   );

-- 3) Supprime les élèves de test.
--    team_members, notifications, submissions, point_transactions partent en
--    cascade ; team_slots.team_id passe à null (case libérée).
delete from public.students
where first_name in ('Testbuff', 'Testbeta', 'Testgamma');

-- 4) Supprime les profils et les comptes auth techniques associés.
delete from public.profiles
where auth_user_id in (select auth_user_id from tmp_test_auth);

delete from auth.users
where id in (select auth_user_id from tmp_test_auth);

commit;

-- 5) Vérification : doit afficher 0 élève de test, 0 équipe "Équipe Test",
--    et toutes les cases 1-15 libres.
select 'Élèves de test restants' as verif, count(*) as n
from public.students
where first_name in ('Testbuff', 'Testbeta', 'Testgamma')
union all
select 'Équipes de test restantes', count(*)
from public.teams
where name = 'Équipe Test'
union all
select 'Cases occupées', count(*)
from public.team_slots
where team_id is not null;