-- ============================================================================
-- MPSI CHALLENGE — Jeu de données élève (à personnaliser)
-- Exécute ce script dans le SQL Editor APRÈS 0001_init.sql.
-- ⚠️ Remplace les prénoms par ceux de TA promotion, puis Run.
-- ============================================================================

insert into public.students (first_name, last_name) values
  ('Arthur',  null),
  ('Jules',   null),
  ('Thomas',  null),
  ('Hugo',    null),
  ('Louis',   null),
  ('Gabriel', null),
  ('Raphaël', null),
  ('Léo',     null),
  ('Timeo',   null),
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
  ('Adam',    null)
on conflict do nothing;

-- Astuce : pour tout réinitialiser plus tard (⚠️ supprime aussi équipes,
-- soumissions et points) :
-- truncate table public.students cascade;
