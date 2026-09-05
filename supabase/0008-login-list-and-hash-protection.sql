-- ============================================================================
-- MPSI CHALLENGE — MIGRATION 0008 : sélecteur de connexion + protection hashes
-- À exécuter dans Dashboard Supabase → SQL Editor.
--
--   1) SUPPRIME la lecture publique de la table students : elle exposait
--      password_hash à n'importe qui (clé anon). Les élèves restent lisibles
--      par les comptes authentifiés (policy existante).
--   2) Crée une vue publique « student_login_list » avec UNIQUEMENT les noms
--      (id, prénom, nom, filière) : c'est elle qui alimente le sélecteur
--      « J'ai déjà un compte » sur la page de connexion.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Plus aucune lecture anonyme sur students (hashes protégés)
-- ---------------------------------------------------------------------------
drop policy if exists "students public read" on public.students;

-- ---------------------------------------------------------------------------
-- 2) Vue publique : uniquement les noms (aucun champ sensible)
-- ---------------------------------------------------------------------------
create or replace view public.student_login_list
with (security_invoker = false) as
  select id, first_name, last_name, track
  from public.students
  where active;

grant select on public.student_login_list to anon, authenticated;

-- ✅ Vérification :
-- select count(*) from public.student_login_list;