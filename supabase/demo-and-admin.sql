-- ============================================================================
-- MPSI CHALLENGE — SCRIPT ADMIN UNIQUE
-- À exécuter dans Dashboard Supabase → SQL Editor.
--
-- Ce script fait UNE seule chose : activer le compte Super Admin
-- (e-mail + mot de passe + rôle). Il ne crée AUCUN élève, AUCUN défi,
-- AUCUNE équipe — la base démarre 100 % vide (listes d'élèves et de défis
-- vides), tout est créé ensuite depuis l'interface admin.
--
-- ⚠️  Remplacez MOT_DE_PASSE_ADMIN par le vrai mot de passe du Super Admin
-- (jamais committé en clair ; conservez-le dans vos secrets).
-- ============================================================================

-- 1) Mot de passe + e-mail confirmé du Super Admin
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    encrypted_password = crypt('MOT_DE_PASSE_ADMIN', gen_salt('bf'))
where email = 'julesabbe0307@gmail.com';

-- 2) Rôle admin sur son profil
update public.profiles
set role = 'admin'
where auth_user_id = (select id from auth.users where email = 'julesabbe0307@gmail.com');
