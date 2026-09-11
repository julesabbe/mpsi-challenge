-- ============================================================================
-- MPSI CHALLENGE — PATCH 0017 : dépôt des vidéos (défis + présentation équipe)
-- À exécuter dans Dashboard Supabase → SQL Editor (idempotent).
--
-- Corrige les causes du « impossible de déposer une vidéo » :
--   1) submissions.video_path était NOT NULL alors que l'app enregistrait la
--      ligne AVANT l'envoi du fichier → l'insertion échouait systématiquement.
--      (Le code envoie maintenant d'abord la vidéo, puis la ligne avec son
--       chemin : la colonne reste tolérante à NULL pour les soumissions
--       historiques.)
--   2) Les policies du bucket privé ne prévoyaient ni REMPLACER une vidéo
--      (UPDATE, nécessaire à l'upsert) ni la RETIRER (DELETE), et le Super
--      Admin ne pouvait déposer aucune vidéo (aucune branche admin).
--
-- Redéfinit donc l'intégralité des accès du bucket 'challenge-submissions'.
-- ============================================================================

-- 1) Une vidéo peut manquer (ligne créée avant/indépendamment de l'envoi)
alter table public.submissions
  alter column video_path drop not null;

-- 2) Filière de l'élève connecté (garantie présente pour les policies)
create or replace function public.my_track()
returns text language sql stable security definer set search_path = public as $$
  select s.track from public.students s
  where s.id = public.my_student_id();
$$;

-- 3) Bucket privé : 150 Mo, formats vidéo uniquement
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('challenge-submissions', 'challenge-submissions', false, 157286400,
        array['video/mp4','video/quicktime','video/webm'])
on conflict (id) do update
  set public = false,
      file_size_limit = 157286400,
      allowed_mime_types = array['video/mp4','video/quicktime','video/webm'];

-- 4) LIRE : admin tout · MP/PSI tout (spectateurs/parrains) · MPSI sa propre équipe
drop policy if exists "submissions video read" on storage.objects;
create policy "submissions video read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'challenge-submissions'
    and (
      public.is_admin()
      or public.my_track() = 'mpsi2'
      or (
        public.my_track() = 'mpsi'
        and (storage.foldername(name))[1] = public.my_team_id()::text
      )
    )
  );

-- 5) DÉPOSER : admin partout · MPSI dans le dossier de sa propre équipe
drop policy if exists "submissions video upload" on storage.objects;
create policy "submissions video upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'challenge-submissions'
    and (
      public.is_admin()
      or (
        public.my_track() = 'mpsi'
        and (storage.foldername(name))[1] = public.my_team_id()::text
      )
    )
  );

-- 6) REMPLACER (upsert) : mêmes droits que le dépôt
drop policy if exists "submissions video update" on storage.objects;
create policy "submissions video update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'challenge-submissions'
    and (
      public.is_admin()
      or (
        public.my_track() = 'mpsi'
        and (storage.foldername(name))[1] = public.my_team_id()::text
      )
    )
  )
  with check (
    bucket_id = 'challenge-submissions'
    and (
      public.is_admin()
      or (
        public.my_track() = 'mpsi'
        and (storage.foldername(name))[1] = public.my_team_id()::text
      )
    )
  );

-- 7) SUPPRIMER (retirer/remplacer une vidéo) : mêmes droits
drop policy if exists "submissions video delete" on storage.objects;
create policy "submissions video delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'challenge-submissions'
    and (
      public.is_admin()
      or (
        public.my_track() = 'mpsi'
        and (storage.foldername(name))[1] = public.my_team_id()::text
      )
    )
  );

-- 8) Contrôle : les 4 policies doivent apparaître ci-dessous
select policyname, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'submissions video%'
order by policyname;
