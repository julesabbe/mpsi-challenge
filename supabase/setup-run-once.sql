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
--    is_anonymous = true). On lie l'élève choisi à cet utilisateur anonyme :
--    l'identité persiste sur l'appareil sans compte ni mot de passe.
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

-- Sélection d'identité par l'appareil (remplace la version via profiles)
create or replace function public.select_student_anon(p_student_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current uuid;
begin
  if p_student_id is null then
    raise exception 'Sélection invalide.';
  end if;
  if auth.uid() is null then
    raise exception 'Vous n''avez pas les permissions nécessaires.';
  end if;

  if not exists (select 1 from public.students where id = p_student_id and active) then
    raise exception 'Cet élève n''existe pas ou n''est plus actif.';
  end if;

  -- L'élève est-il déjà lié à un autre appareil/compte ?
  if exists (
    select 1 from public.students
    where id = p_student_id and anon_user_id is not null and anon_user_id <> auth.uid()
  ) then
    raise exception 'Cet élève est déjà associé à un autre appareil.';
  end if;

  -- Cet appareil a-t-il déjà une identité ? (verrouillage après choix)
  select id into v_current from public.students where anon_user_id = auth.uid();
  if v_current is not null then
    if v_current = p_student_id then return; end if;
    raise exception 'Votre identité est déjà définie sur cet appareil.';
  end if;

  update public.students set anon_user_id = auth.uid() where id = p_student_id;
end $$;

-- Les policies RLS existantes utilisent my_student_id() / my_team_id() et le
-- rôle « authenticated » (les sessions anonymes Supabase ont ce rôle) :
-- elles fonctionnent donc sans changement. Vérification :
--   select s.first_name from public.students s where s.anon_user_id = auth.uid();

-- ---------------------------------------------------------------------------
-- 3) ÉLÈVES — personnalise librement cette liste
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
