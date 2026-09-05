-- ============================================================================
-- MPSI CHALLENGE — MIGRATION 0012 : réparation du trigger d'inscription
-- À exécuter dans Dashboard Supabase → SQL Editor.
--
-- Problème : depuis 0011, la contrainte UNIQUE sur profiles.auth_user_id a
-- été retirée (un compte peut avoir plusieurs profils). Le trigger
-- handle_new_user (déclenché à chaque NOUVEAU compte auth) utilisait
-- « on conflict (auth_user_id) do nothing » → erreur :
--   « there is no unique or exclusion constraint matching the ON CONFLICT
--   specification » quand on crée le compte d'une nouvelle personne.
--
-- Correctif : la fonction insère le profil avec un test d'existence
-- (sans ON CONFLICT) + index sur profiles(auth_user_id). Idempotent.
-- ============================================================================

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

  if not exists (select 1 from public.profiles where auth_user_id = new.id) then
    insert into public.profiles (auth_user_id, role)
    values (
      new.id,
      case when new.id::text = any(v_admin_ids) then 'admin' else 'user' end
    );
  end if;
  return new;
end $$;

-- Index pour les recherches par compte (l'unicité ayant été levée en 0011)
create index if not exists profiles_auth_user_idx
  on public.profiles (auth_user_id);

-- Le trigger pointe déjà vers la fonction du même nom, on s'assure qu'il
-- existe bien (recréation idempotente)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
