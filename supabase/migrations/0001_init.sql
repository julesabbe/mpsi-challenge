-- ============================================================================
-- MPSI CHALLENGE — Initial schema
-- Run in Supabase Dashboard → SQL Editor. Idempotent.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tables ----

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- role: 'user' | 'admin'
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  student_id uuid unique references public.students(id) on delete set null,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text not null default '⚡',
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  student_id uuid not null unique references public.students(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists team_members_team_idx on public.team_members(team_id);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  points integer not null check (points > 0),
  difficulty text not null default 'easy'
    check (difficulty in ('easy','medium','hard','extreme')),
  category text not null default 'team'
    check (category in ('social','sport','creative','school','funny','team')),
  video_required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  submitted_by uuid not null references public.students(id) on delete cascade,
  video_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);
create index if not exists submissions_team_idx on public.submissions(team_id);
create index if not exists submissions_challenge_idx on public.submissions(challenge_id);
create index if not exists submissions_status_idx on public.submissions(status);

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  amount integer not null,
  type text not null check (type in ('challenge','bonus','penalty','manual_adjustment')),
  reason text not null default '',
  challenge_id uuid references public.challenges(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists point_transactions_team_idx on public.point_transactions(team_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- ------------------------------------------------------------ triggers ------

-- Create a profile for every new auth user. Role 'admin' is granted only to
-- the ADMIN_AUTH_USER_IDS configured in supabase/config.toml (never trust the
-- frontend).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_admin_ids text[];
begin
  begin
    v_admin_ids := string_to_array(
      coalesce(current_setting('app.admin_auth_user_ids', true), ''), ','
    );
  exception when others then
    v_admin_ids := array[]::text[];
  end;

  insert into public.profiles (auth_user_id, role)
  values (
    new.id,
    case when new.id::text = any(v_admin_ids) then 'admin' else 'user' end
  )
  on conflict (auth_user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at for challenges
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists challenges_touch_updated on public.challenges;
create trigger challenges_touch_updated
  before update on public.challenges
  for each row execute function public.touch_updated_at();

-- Notify all team members when a submission is reviewed
create or replace function public.notify_on_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s record;
  m record;
  t_name text;
begin
  if new.status = old.status then return new; end if;
  -- Évite le doublon avec le trigger on_point_transaction : ce dernier notifie
  -- déjà les membres lors du crédit des points qui suit une validation.
  if new.status = 'approved' and old.status = 'pending' then
    return new;
  end if;
  select name into t_name from public.teams where id = new.team_id;
  select * into s from public.challenges where id = new.challenge_id;

  if new.status = 'approved' then
    for m in select student_id from public.team_members where team_id = new.team_id loop
      insert into public.notifications (user_id, title, message)
      values (m.student_id, '🎉 Défi validé !',
        format('« %s » validé pour %s : +%s points !', s.title, t_name, s.points));
    end loop;
  elsif new.status = 'rejected' then
    for m in select student_id from public.team_members where team_id = new.team_id loop
      insert into public.notifications (user_id, title, message)
      values (m.student_id, '❌ Défi refusé',
        format('« %s » n''a pas été validé. Raison : %s',
               s.title, coalesce(new.rejection_reason, 'non communiquée')));
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists on_submission_reviewed on public.submissions;
create trigger on_submission_reviewed
  after update of status on public.submissions
  for each row execute function public.notify_on_review();

-- Notify team members on bonus / penalty
create or replace function public.notify_on_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m record;
  t_name text;
begin
  select name into t_name from public.teams where id = new.team_id;
  for m in select student_id from public.team_members where team_id = new.team_id loop
    insert into public.notifications (user_id, title, message)
    values (m.student_id,
      case when new.amount >= 0 then '⭐ Points bonus' else '⚠️ Points retirés' end,
      format('%s : %s points (%s)', t_name, new.amount, nullif(new.reason, '')));
  end loop;
  return new;
end $$;

drop trigger if exists on_point_transaction on public.point_transactions;
create trigger on_point_transaction
  after insert on public.point_transactions
  for each row execute function public.notify_on_points();

-- --------------------------------------------------------------- helpers ----

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid() and role = 'admin'
  );
$$;

-- my_student_id() = the student linked to the current auth user (only if active)
create or replace function public.my_student_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.student_id from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.student_id is not null
    and (select s.active from public.students s where s.id = p.student_id) is true;
$$;

create or replace function public.my_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tm.team_id from public.team_members tm
  where tm.student_id = public.my_student_id();
$$;

-- ------------------------------------------------------- team RPC ----------

-- Atomically create a team of exactly 3 students (creator included).
-- Returns the new team id. Throws descriptive errors (in French) otherwise.
create or replace function public.create_team_rpc(
  p_team_name text,
  p_member2 uuid,
  p_member3 uuid,
  p_emoji text default '⚡'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.my_student_id();
  v_team uuid;
begin
  if v_me is null then
    raise exception 'Vous devez d''abord sélectionner votre identité.';
  end if;

  p_team_name := nullif(btrim(p_team_name), '');
  if p_team_name is null then
    raise exception 'Le nom de l''équipe est obligatoire.';
  end if;
  if length(p_team_name) < 2 or length(p_team_name) > 40 then
    raise exception 'Le nom de l''équipe doit contenir entre 2 et 40 caractères.';
  end if;
  if p_member2 is null or p_member3 is null then
    raise exception 'Vous devez sélectionner deux autres membres.';
  end if;
  if p_member2 = p_member3 then
    raise exception 'Impossible de sélectionner deux fois la même personne.';
  end if;
  if p_member2 = v_me or p_member3 = v_me then
    raise exception 'Impossible de vous sélectionner vous-même.';
  end if;

  select tm.team_id into v_team from public.team_members tm
  where tm.student_id in (v_me, p_member2, p_member3);
  if v_team is not null then
    if exists (select 1 from public.team_members tm where tm.student_id = v_me) then
      raise exception 'Vous appartenez déjà à une équipe.';
    end if;
    raise exception 'Cet élève appartient déjà à une équipe.';
  end if;

  if exists (select 1 from public.teams where lower(name) = lower(p_team_name)) then
    raise exception 'Ce nom d''équipe est déjà pris.';
  end if;

  insert into public.teams (name, emoji)
  values (p_team_name, coalesce(nullif(btrim(coalesce(p_emoji, '')), ''), '⚡'))
  returning id into v_team;

  insert into public.team_members (team_id, student_id)
  values (v_team, v_me), (v_team, p_member2), (v_team, p_member3);

  return v_team;
end $$;

-- Attach the current auth user to the chosen student (identity selection).
create or replace function public.select_student_rpc(p_student_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_current uuid;
begin
  if p_student_id is null then
    raise exception 'Sélection invalide.';
  end if;

  if not exists (select 1 from public.students where id = p_student_id and active) then
    raise exception 'Cet élève n''existe pas ou n''est plus actif.';
  end if;

  select id, student_id into v_profile, v_current
  from public.profiles where auth_user_id = auth.uid();
  if v_profile is null then
    raise exception 'Vous n''avez pas les permissions nécessaires.';
  end if;

  -- L'identité est verrouillée après la première sélection.
  if v_current is not null then
    if v_current = p_student_id then return; end if;
    raise exception 'Votre identité est déjà définie. Contactez l''administrateur pour la modifier.';
  end if;

  -- Each student can be linked to at most one account, and each account to one student.
  if exists (
    select 1 from public.profiles
    where student_id = p_student_id and auth_user_id <> auth.uid()
  ) then
    raise exception 'Cet élève est déjà associé à un compte.';
  end if;

  update public.profiles
  set student_id = p_student_id
  where id = v_profile;
end $$;

-- Review a submission: approve (award points once) or reject with reason.
create or replace function public.review_submission_rpc(
  p_submission_id uuid,
  p_approve boolean,
  p_rejection_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sub public.submissions;
  v_pts integer;
begin
  if not public.is_admin() then
    raise exception 'Vous n''avez pas les permissions nécessaires.';
  end if;

  select * into v_sub from public.submissions where id = p_submission_id;
  if v_sub.id is null then raise exception 'Soumission introuvable.'; end if;
  if v_sub.status <> 'pending' then
    raise exception 'Cette soumission a déjà été traitée.';
  end if;

  if p_approve then
    select points into v_pts from public.challenges where id = v_sub.challenge_id;

    update public.submissions
    set status = 'approved', reviewed_at = now(),
        reviewed_by = (select id from public.profiles where auth_user_id = auth.uid())
    where id = p_submission_id;

    -- Credit points exactly once (idempotent guard)
    if not exists (
      select 1 from public.point_transactions
      where team_id = v_sub.team_id and challenge_id = v_sub.challenge_id
        and type = 'challenge'
    ) then
      insert into public.point_transactions (team_id, amount, type, reason, challenge_id, created_by)
      values (v_sub.team_id, v_pts, 'challenge',
              'Défi validé : ' || (select title from public.challenges where id = v_sub.challenge_id),
              v_sub.challenge_id,
              (select id from public.profiles where auth_user_id = auth.uid()));
    end if;
  else
    update public.submissions
    set status = 'rejected', reviewed_at = now(),
        reviewed_by = (select id from public.profiles where auth_user_id = auth.uid()),
        rejection_reason = coalesce(nullif(btrim(p_rejection_reason), ''), 'La vidéo ne permet pas de vérifier le défi.')
    where id = p_submission_id;
  end if;
end $$;

-- ------------------------------------------------------------------- RLS ----

alter table public.students enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.challenges enable row level security;
alter table public.submissions enable row level security;
alter table public.point_transactions enable row level security;
alter table public.notifications enable row level security;

-- students: authenticated users can read the roster; admins manage
drop policy if exists "students read" on public.students;
create policy "students read" on public.students
  for select to authenticated using (true);
drop policy if exists "students admin all" on public.students;
create policy "students admin all" on public.students
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles: you see your own; admins see all
drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
  for select to authenticated using (auth_user_id = auth.uid() or public.is_admin());

-- teams: everyone authenticated reads; only admins modify directly
-- (users create teams through the security-definer RPC)
drop policy if exists "teams read" on public.teams;
create policy "teams read" on public.teams
  for select to authenticated using (true);
drop policy if exists "teams admin all" on public.teams;
create policy "teams admin all" on public.teams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "team_members read" on public.team_members;
create policy "team_members read" on public.team_members
  for select to authenticated using (true);
drop policy if exists "team_members admin all" on public.team_members;
create policy "team_members admin all" on public.team_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "challenges read" on public.challenges;
create policy "challenges read" on public.challenges
  for select to authenticated using (true);
drop policy if exists "challenges admin all" on public.challenges;
create policy "challenges admin all" on public.challenges
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- submissions: everyone authenticated can read (status/leaderboard context);
-- a user inserts ONLY for their own team and only as themselves.
drop policy if exists "submissions read" on public.submissions;
create policy "submissions read" on public.submissions
  for select to authenticated using (true);
drop policy if exists "submissions insert own team" on public.submissions;
create policy "submissions insert own team" on public.submissions
  for insert to authenticated with check (
    team_id = public.my_team_id() and submitted_by = public.my_student_id()
  );
drop policy if exists "submissions admin all" on public.submissions;
create policy "submissions admin all" on public.submissions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- point transactions: read-only for users, admins manage (via RPC / dashboard)
drop policy if exists "point_transactions read" on public.point_transactions;
create policy "point_transactions read" on public.point_transactions
  for select to authenticated using (true);
drop policy if exists "point_transactions admin all" on public.point_transactions;
create policy "point_transactions admin all" on public.point_transactions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- notifications: only your own
drop policy if exists "notifications own" on public.notifications;
create policy "notifications own" on public.notifications
  for select to authenticated using (user_id = public.my_student_id());
drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications
  for update to authenticated using (user_id = public.my_student_id())
  with check (user_id = public.my_student_id());
drop policy if exists "notifications admin all" on public.notifications;
create policy "notifications admin all" on public.notifications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------- storage ----

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('challenge-submissions', 'challenge-submissions', false, 157286400,
        array['video/mp4','video/quicktime','video/webm'])
on conflict (id) do update
  set public = false,
      file_size_limit = 157286400,
      allowed_mime_types = array['video/mp4','video/quicktime','video/webm'];

-- Path convention: <team_id>/<challenge_id>/<submission_id>.<ext>
drop policy if exists "submissions video read" on storage.objects;
create policy "submissions video read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'challenge-submissions'
    and public.is_admin()
  );

drop policy if exists "submissions video upload" on storage.objects;
create policy "submissions video upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'challenge-submissions'
    and (storage.foldername(name))[1] = public.my_team_id()::text
  );

-- ------------------------------------------------------------------ seed ----

insert into public.challenges (title, description, points, difficulty, category) values
  ('Photo d''équipe devant la prépa', 'Faire une photo avec toute l''équipe devant l''entrée de la prépa.', 100, 'easy', 'school'),
  ('Chanson dans un lieu public', 'Faire chanter toute l''équipe dans un lieu public (gare, rue, centre commercial…).', 250, 'medium', 'social'),
  ('Reproduire une scène de film', 'Reproduire une célèbre scène de film, costumes et décor compris. Film obligatoire.', 500, 'hard', 'creative'),
  ('Pyramide humaine', 'Réaliser une pyramide humaine à 3 avec au moins 2 secondes de tenue.', 150, 'medium', 'sport'),
  ('Rêve de la promo', 'Demandez à un professeur de réaliser un défi buffon avec vous.', 300, 'medium', 'funny'),
  ('100 pompes cumulées', 'Effectuer 100 pompes cumulées dans la journée, filmées en continu par segments.', 200, 'hard', 'sport'),
  ('Cours en costume', 'Assister à un cours entier en costume trois-pièces.', 150, 'easy', 'school'),
  ('Flashmob au lycée', 'Organiser un mini flashmob de 30 secondes à la pause déjeuner.', 350, 'hard', 'social'),
  ('Pause publicitaire', 'Créer une publicité inventée de 30 secondes pour un objet de votre choix.', 250, 'medium', 'creative'),
  ('Défi du chef', 'Préparer et faire goûter un plat mystère à un élève d''une autre équipe.', 200, 'medium', 'funny'),
  ('Puzzle géant', 'Terminer un puzzle de 500 pièces en moins de 48 h et montrer le résultat.', 300, 'medium', 'team'),
  ('L''ascension', 'Gravir le plus haut point de la ville et prendre une photo d''équipe.', 400, 'hard', 'sport'),
  ('Karaoké 10', 'Chanter 10 chansons consécutives au karaoké sans oublier les paroles.', 450, 'hard', 'social'),
  ('Défi d''improvisation', 'Improviser un discours de 2 minutes sur un sujet imposé par une autre équipe.', 200, 'medium', 'creative'),
  ('L''extrême : saut dans l''inconnu', 'Réaliser un défi sportif extrême (accrobranche, escalade…). Preuve obligatoire.', 800, 'extreme', 'sport'),
  ('Secret de la prépa', 'Découvrir et documenter un lieu secret ou insolite de la prépa.', 250, 'medium', 'funny'),
  ('Cuisine du monde', 'Faire goûter un plat typique d''un autre pays à la classe.', 300, 'medium', 'social'),
  ('Recréez un tableau', 'Recréer un tableau célèbre en photo avec les membres de l''équipe.', 350, 'hard', 'creative')
on conflict do nothing;
