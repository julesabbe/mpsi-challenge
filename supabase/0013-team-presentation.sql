-- ============================================================================
-- MPSI CHALLENGE — MIGRATION 0013 : vidéo de présentation d'équipe
-- À exécuter dans Dashboard Supabase → SQL Editor.
--
-- Ajoute, sur chaque équipe, une vidéo de présentation (facultative) :
--   • teams.presentation_video_path + presentation_uploaded_at
--   • set_team_presentation(...) : seul un membre de l'équipe peut
--     l'enregistrer / la remplacer (via la session, compatible avec les
--     identités fusionnées de 0011)
--   • my_student_id() devient déterministe : pour un compte multi-filières,
--     c'est l'identité MPSI (participante) qui est utilisée par les
--     policies de stockage.
-- Les policies Storage existantes s'appliquent telles quelles (la vidéo est
-- stockée sous <team_id>/presentation.<ext>, même accès que les preuves :
-- MPSI → sa propre équipe, MP/PSI → tout, admin → tout).
-- Idempotent.
-- ============================================================================

-- 1) Colonnes de présentation sur les équipes
alter table public.teams
  add column if not exists presentation_video_path text,
  add column if not exists presentation_uploaded_at timestamptz;

-- 2) Identité « agissante » déterministe : priorité à l'élève MPSI
--    (participant), puis au plus ancien. Évite les comportements aléatoires
--    quand un même compte a plusieurs profils (fusion 0011).
create or replace function public.my_student_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select p.student_id
  from public.profiles p
  join public.students s on s.id = p.student_id
  where p.auth_user_id = auth.uid()
    and s.active
  order by case when s.track = 'mpsi' then 0 else 1 end, s.created_at
  limit 1;
$$;

-- 3) Enregistrer / remplacer la vidéo de présentation (membres uniquement)
create or replace function public.set_team_presentation(p_team_id uuid, p_path text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Connecte-toi d''abord.';
  end if;
  if not exists (
    select 1 from public.team_members tm
    join public.profiles p on p.student_id = tm.student_id
    join public.students s on s.id = tm.student_id
    where tm.team_id = p_team_id
      and p.auth_user_id = auth.uid()
      and s.active
  ) then
    raise exception 'Tu n''es pas membre de cette équipe.';
  end if;

  update public.teams
  set presentation_video_path = nullif(btrim(p_path), ''),
      presentation_uploaded_at = now()
  where id = p_team_id;
end $$;
