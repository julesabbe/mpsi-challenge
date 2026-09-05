-- ============================================================================
-- ⚠️  OBSOLÈTE — NE PAS EXÉCUTER.
-- Ancien script « identité par appareil » (session anonyme + prénom),
-- remplacé par les migrations 0002 → 0010 (comptes élèves par mot de passe,
-- aucune donnée simulée). Utilisez demo-and-admin.sql (compte admin) puis
-- créez défis/élèves depuis l'interface /admin.
-- ============================================================================
-- ============================================================================
-- MPSI CHALLENGE — SCRIPT UNIQUE À EXÉCUTER (Dashboard Supabase → SQL Editor)
-- Modèle : seul le Super Admin a un compte. Les élèves sont identifiés par
-- leur appareil (session anonyme Supabase liée à leur prénom).
--
-- Ce script :
--   1) Active le mot de passe du Super Admin (julesabbe0307@gmail.com)
--      et lui donne le rôle admin
--   2) Passe la base en « mode invité / identité par appareil »
--   3) Insère la liste des élèves (modifiable librement)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) SUPER ADMIN — e-mail + mot de passe + rôle
-- ---------------------------------------------------------------------------
-- ⚠️  Remplacez MOT_DE_PASSE_ADMIN par le vrai mot de passe du Super Admin
-- (jamais committé en clair ; utilisez un secret / .env pour le conserver)
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    encrypted_password = crypt('MOT_DE_PASSE_ADMIN', gen_salt('bf'))
where email = 'julesabbe0307@gmail.com';

update public.profiles
set role = 'admin'
where auth_user_id = (select id from auth.users where email = 'julesabbe0307@gmail.com');

-- ---------------------------------------------------------------------------
-- 2) MODE INVITÉ / IDENTITÉ PAR APPAREIL
--    Chaque appareil obtient une session anonyme Supabase (auth.users avec
--    is_anonymous = true). L'élève écrit SON prénom : le premier appareil qui
--    l'utilise lui est définitivement associé (l'identité persiste sur
--    l'appareil sans compte ni mot de passe).
-- ---------------------------------------------------------------------------

-- Colonne de liaison appareil ↔ élève
alter table public.students
  add column if not exists anon_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists students_anon_user_idx on public.students(anon_user_id)
  where anon_user_id is not null;

-- Résolution de l'identité courante : appareil anonyme d'abord, compte admin ensuite
create or replace function public.my_student_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select s.id from public.students s
  where s.anon_user_id = auth.uid() and s.active
  union all
  select p.student_id from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.student_id is not null
    and exists (select 1 from public.students s2 where s2.id = p.student_id and s2.active)
  limit 1;
$$;

-- Revendication ou création du prénom par l'appareil (remplace select_student_anon)
-- Le premier appareil qui utilise un prénom lui est définitivement associé.
create or replace function public.claim_or_create_student(p_first_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(p_first_name), '');
  v_student uuid;
  v_mine uuid;
begin
  if auth.uid() is null then
    raise exception 'Vous n''avez pas les permissions nécessaires.';
  end if;

  -- Normalisation : lettres, espaces, tirets, apostrophes ; 2 à 40 caractères
  if v_name is null or length(v_name) < 2 or length(v_name) > 40 then
    raise exception 'Le prénom doit contenir entre 2 et 40 caractères.';
  end if;
  if v_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ'' -]+$' then
    raise exception 'Le prénom ne doit contenir que des lettres.';
  end if;

  -- Cet appareil a-t-il déjà une identité ? (verrouillée après le choix)
  select id into v_mine from public.students where anon_user_id = auth.uid();
  if v_mine is not null then
    if lower((select first_name from public.students where id = v_mine)) = lower(v_name) then
      return v_mine;
    end if;
    raise exception 'Cet appareil est déjà associé à un prénom.';
  end if;

  -- Le prénom existe déjà (roster pré-rempli ou déjà revendiqué) ?
  select id into v_student
  from public.students
  where lower(first_name) = lower(v_name)
    and active
  limit 1;

  -- Existe mais désactivé par l'admin : le nom reste réservé
  if v_student is null and exists (
    select 1 from public.students where lower(first_name) = lower(v_name)
  ) then
    raise exception 'Ce prénom a été désactivé. Contactez le Super Admin.';
  end if;

  if v_student is not null then
    -- Déjà pris par un autre appareil ?
    if exists (
      select 1 from public.students
      where id = v_student and anon_user_id is not null and anon_user_id <> auth.uid()
    ) then
      raise exception 'Ce prénom est déjà associé à un autre appareil.';
    end if;
    update public.students set anon_user_id = auth.uid() where id = v_student;
    return v_student;
  end if;

  -- Nouveau prénom : création de l'élève, lié définitivement à cet appareil
  insert into public.students (first_name, anon_user_id)
  values (v_name, auth.uid())
  returning id into v_student;
  return v_student;
end $$;

-- Un prénom = un seul élève (insensible à la casse), premier arrivé, premier servi
create unique index if not exists students_first_name_uniq
  on public.students (lower(first_name));

-- Les policies RLS existantes utilisent my_student_id() / my_team_id() et le
-- rôle « authenticated » (les sessions anonymes Supabase ont ce rôle) :
-- elles fonctionnent donc sans changement. Vérification :
--   select s.first_name from public.students s where s.anon_user_id = auth.uid();

-- ---------------------------------------------------------------------------
-- 3) ÉLÈVES (facultatif) — liste pré-remplie, revendicable par les appareils
--    Les élèves peuvent aussi ajouter eux-mêmes leur prénom : cette liste sert
--    juste de base (noms déjà disponibles avant que les appareils les prennent).
-- ---------------------------------------------------------------------------
insert into public.students (first_name, last_name) values
  ('Arthur',  null),
  ('Jules',   null),
  ('Thomas',  null),
  ('Hugo',    null),
  ('Louis',   null),
  ('Gabriel', null),
  ('Raphaël', null),
  ('Léo',     null),
  ('Timéo',   null),
  ('Lucas',   null),
  ('Maxime',  null),
  ('Enzo',    null),
  ('Nathan',  null),
  ('Clément', null),
  ('Théo',    null),
  ('Baptiste',null),
  ('Noah',    null),
  ('Sacha',   null),
  ('Paul',    null),
  ('Adam',    null),
  ('Malo',    null),
  ('Ethan',   null),
  ('Antoine', null),
  ('Valentin',null)
on conflict do nothing;
