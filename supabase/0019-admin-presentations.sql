-- ============================================================================
-- MPSI CHALLENGE — PATCH 0019 : le Super Admin voit et modère les vidéos de
-- présentation d'équipe
-- À exécuter dans Supabase → SQL Editor (projet qdybahzbixudaeowefdi).
-- Idempotent.
--
-- Contexte : jusqu'ici le Super Admin était le SEUL rôle à n'avoir accès à
-- aucune vidéo de présentation. Les preuves de défi sont validables dans
-- /admin/submissions, mais les présentations n'apparaissaient que :
--   • pour l'équipe elle-même (dashboard + /team),
--   • pour les MP/PSI dans /parrainage.
-- Il ne pouvait donc ni vérifier leur contenu, ni retirer une vidéo
-- inappropriée, alors même que les policies Storage de 0017 l'y autorisent.
--
-- La lecture est déjà couverte : la policy « teams public read » permet au
-- Super Admin de lire teams.presentation_video_path, et la policy
-- « submissions video read » de 0017 lui donne accès à tout le bucket.
-- Il ne manquait que le droit d'EFFACER la référence côté base : la table
-- teams n'a qu'une policy de lecture, donc un UPDATE direct depuis le client
-- serait rejeté par RLS. D'où cette fonction.
-- ============================================================================

-- Retire la vidéo de présentation d'une équipe (Super Admin uniquement).
-- Renvoie l'ancien chemin pour que le client puisse aussi supprimer le
-- fichier du bucket Storage (on ne touche pas à storage.objects en SQL :
-- effacer la ligne ne supprimerait pas le fichier sur le stockage).
create or replace function public.admin_clear_team_presentation(p_team_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_path text;
begin
  if auth.uid() is null then
    raise exception 'Connecte-toi d''abord.';
  end if;

  -- Contrôle explicite sur public.profiles (plutôt que public.is_admin())
  -- pour que cette fonction reste autonome : la table est la source de
  -- vérité du rôle, aucune dépendance à une fonction annexe.
  if not exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Réservé au Super Admin.';
  end if;

  select presentation_video_path into v_path
  from public.teams
  where id = p_team_id;

  -- Équipe inconnue ou déjà sans vidéo : rien à faire, pas d'erreur.
  if v_path is null then
    return null;
  end if;

  update public.teams
  set presentation_video_path = null,
      presentation_uploaded_at = null
  where id = p_team_id;

  return v_path;
end $$;

-- Seuls les comptes connectés peuvent l'appeler ; le contrôle admin est
-- fait à l'intérieur, en SECURITY DEFINER.
revoke all on function public.admin_clear_team_presentation(uuid) from public;
grant execute on function public.admin_clear_team_presentation(uuid) to authenticated;

-- Forcer PostgREST à exposer la nouvelle fonction immédiatement.
notify pgrst, 'reload schema';

-- Contrôle : la fonction doit apparaître avec la signature attendue.
select p.proname as fonction,
       pg_get_function_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'admin_clear_team_presentation';
