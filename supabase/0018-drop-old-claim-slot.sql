-- ============================================================================
-- MPSI CHALLENGE — PATCH 0018 : supprime l'ancienne surcharge claim_team_slot
-- À exécuter dans Supabase → SQL Editor (projet qdybahzbixudaeowefdi).
--
-- Problème : la migration 0015 a CRÉÉ la fonction à 6 paramètres (avec
-- p_member4) mais n'a pas supprimé l'ancienne à 5 paramètres. PostgreSQL
-- garde donc DEUX surcharges :
--    claim_team_slot(int,text,text,uuid,uuid)
--    claim_team_slot(int,text,text,uuid,uuid,uuid)
-- Comme p_member4 a une valeur par défaut, un appel nommé à 5 arguments peut
-- correspondre aux DEUX → PostgreSQL refuse :
--    "Could not choose the best candidate function between ..."
--
-- Ce patch supprime l'ancienne version à 5 paramètres. Il ne reste que la
-- version à 6 paramètres, qui gère les cases 1-14 (3 membres) comme la case
-- 15 (4 membres). Idempotent : réexécutable sans risque.
-- ============================================================================

-- 1) Supprime l'ancienne surcharge à 5 paramètres (signature exacte).
drop function if exists public.claim_team_slot(integer, text, text, uuid, uuid);

-- 2) Sécurité : si une variante à 6 paramètres où p_member4 n'a PAS de valeur
--    par défaut traîne, on s'assure que la bonne version est en place.
--    (On recrée la version de référence, identique à 0015.)
create or replace function public.claim_team_slot(
  p_slot int, p_team_name text, p_emoji text,
  p_member2 uuid, p_member3 uuid, p_member4 uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.my_student_id();
  v_track text;
  v_team uuid;
  v_members uuid[];
begin
  if v_me is null then
    raise exception 'Connecte-toi d''abord.';
  end if;

  select track into v_track from public.students where id = v_me;
  if v_track <> 'mpsi' then
    raise exception 'Seuls les élèves MPSI peuvent créer une équipe.';
  end if;

  if p_slot is null or p_slot < 1 or p_slot > 15 then
    raise exception 'Case invalide (1 à 15).';
  end if;

  if exists (select 1 from public.team_members where student_id = v_me) then
    raise exception 'Tu fais déjà partie d''une équipe.';
  end if;

  p_team_name := nullif(btrim(p_team_name), '');
  if p_team_name is null or length(p_team_name) < 2 or length(p_team_name) > 40 then
    raise exception 'Le nom de l''équipe doit contenir entre 2 et 40 caractères.';
  end if;

  if p_slot = 15 then
    if p_member2 is null or p_member3 is null or p_member4 is null then
      raise exception 'La case 15 demande 3 coéquipiers distincts (toi inclus, 4 membres).';
    end if;
    v_members := array[v_me, p_member2, p_member3, p_member4];
  else
    if p_member2 is null or p_member3 is null or p_member2 = p_member3 then
      raise exception 'Sélectionne 2 coéquipiers distincts (toi inclus).';
    end if;
    v_members := array[v_me, p_member2, p_member3];
  end if;

  if (select count(distinct m) from unnest(v_members) m) <> array_length(v_members, 1) then
    raise exception 'Les coéquipiers sélectionnés doivent être distincts.';
  end if;

  if exists (
    select 1 from public.students
    where id = any (v_members) and track <> 'mpsi'
  ) then
    raise exception 'Tous les membres doivent être en MPSI.';
  end if;

  if exists (
    select 1 from public.team_members where student_id = any (v_members) and student_id <> v_me
  ) then
    raise exception 'Un des élèves sélectionnés a déjà une équipe.';
  end if;

  update public.team_slots
  set team_id = null, created_by = v_me
  where slot_number = p_slot and team_id is null;
  if not found then
    raise exception 'Cette case est déjà prise.';
  end if;

  insert into public.teams (name, emoji)
  values (p_team_name, coalesce(nullif(btrim(p_emoji), ''), '⚡'))
  returning id into v_team;

  insert into public.team_members (team_id, student_id)
  select v_team, unnest(v_members);

  update public.team_slots
  set team_id = v_team, created_by = v_me
  where slot_number = p_slot;

  return v_team;
end;
$$;

-- 3) Forcer PostgREST à recharger son cache de schéma immédiatement.
notify pgrst, 'reload schema';

-- 4) Contrôle : il ne doit rester QU'UNE seule ligne (6 arguments).
select
  p.proname as fonction,
  pg_get_function_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'claim_team_slot';
