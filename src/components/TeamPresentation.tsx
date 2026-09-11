"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { newId, validateVideoFile } from "@/lib/utils";
import { cx } from "@/lib/utils";
import { removeVideo, uploadVideo, videoExtension } from "@/lib/upload-video";

/**
 * Vidéo de présentation de l'équipe : visible par l'équipe (et les comptes
 * autorisés selon les policies Storage), modifiable par ses membres.
 * Stockée sous `<team_id>/presentation.<ext>` dans le bucket privé.
 */
export function TeamPresentation({
  teamId,
  videoPath,
  canManage = true,
}: {
  teamId: string;
  videoPath: string | null;
  canManage?: boolean;
}) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [signedUrl, setSignedUrl] = useState<string | null | undefined>(
    undefined
  );
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // URL signée (1 h) dès qu'une vidéo est enregistrée
  useEffect(() => {
    let cancelled = false;
    if (!videoPath) {
      setSignedUrl(null);
      return;
    }
    (async () => {
      const { data } = await supabase.storage
        .from("challenge-submissions")
        .createSignedUrl(videoPath, 3600);
      if (!cancelled) setSignedUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [videoPath, supabase]);

  function pickFile(f: File | null) {
    setError(null);
    if (!f) return;
    const problem = validateVideoFile(f);
    if (problem) {
      setError(problem);
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function reset() {
    setFile(null);
    setPreviewUrl(null);
    setProgress(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload() {
    if (!file) return;
    setError(null);
    setBusy(true);
    setProgress(0);
    // Nom de fichier unique : l'envoi reste un simple INSERT (autorisé par les
    // policies Storage), sans upsert ni écrasement — l'ancienne vidéo est
    // supprimée après le basculement.
    const previous = videoPath;
    const path = `${teamId}/presentation-${newId()}.${videoExtension(file)}`;
    try {
      await uploadVideo(supabase, path, file, { onProgress: setProgress });

      const { error: rpcError } = await supabase.rpc("set_team_presentation", {
        p_team_id: teamId,
        p_path: path,
      });
      if (rpcError) {
        await removeVideo(supabase, path);
        throw rpcError;
      }

      if (previous && previous !== path) await removeVideo(supabase, previous);

      reset();
      router.refresh();
    } catch (err) {
      const message = (err as Error).message || "Une erreur est survenue.";
      setError(
        message.includes("row-level security") || message.includes("permissions")
          ? "Vous n'avez pas les permissions nécessaires."
          : message
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteVideo() {
    setError(null);
    const previous = videoPath;
    const { error: rpcError } = await supabase.rpc("set_team_presentation", {
      p_team_id: teamId,
      p_path: "",
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    // La référence en base est retirée : on nettoie le fichier (best-effort).
    await removeVideo(supabase, previous);
    router.refresh();
  }

  const sizeMb = file ? (file.size / (1024 * 1024)).toFixed(1) : null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-extrabold text-white">🎬 Vidéo de présentation</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Présentez votre équipe en vidéo (MP4, MOV ou WebM · 150 Mo max).
          </p>
        </div>
        {videoPath && canManage ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
          >
            Remplacer
          </button>
        ) : null}
      </div>

      {videoPath ? (
        <div className="mt-3">
          {signedUrl === null ? (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-black/60">
              <p className="px-6 text-center text-sm text-zinc-500">
                🔒 Vidéo non accessible depuis ton compte
              </p>
            </div>
          ) : signedUrl ? (
            <video
              src={signedUrl}
              controls
              preload="metadata"
              className="aspect-video w-full rounded-2xl bg-black"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-black/60">
              <p className="text-sm text-zinc-500">Chargement…</p>
            </div>
          )}

          {canManage ? (
            <button
              type="button"
              onClick={deleteVideo}
              className="mt-2 text-xs font-semibold text-zinc-500 transition hover:text-red-300"
            >
              🗑️ Retirer la vidéo de présentation
            </button>
          ) : null}
        </div>
      ) : canManage && !file ? (
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-4 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] px-6 py-8 text-center transition hover:border-violet-500/50 hover:bg-violet-500/5"
          >
            <span className="text-3xl" aria-hidden>
              📹
            </span>
            <span className="mt-2 text-sm font-semibold text-zinc-300">
              Ajouter une vidéo de présentation
            </span>
            <span className="mt-1 text-xs text-zinc-500">
              Qui êtes-vous, votre stratégie, un défi… à vous de jouer !
            </span>
          </button>
        </div>
      ) : null}

      {file ? (
        <div className="mt-3">
          <video
            src={previewUrl ?? undefined}
            controls
            className="max-h-72 w-full rounded-2xl bg-black"
          />
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="truncate text-zinc-300">{file.name}</span>
            <span className="ml-2 shrink-0 text-zinc-500">{sizeMb} Mo</span>
          </div>

          {busy ? (
            <div className="mt-3">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-center text-xs text-zinc-400">
                Envoi… {progress}%
              </p>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={upload}
                disabled={!file}
                className="btn-primary flex-1"
              >
                {videoPath ? "REMPLACER LA VIDÉO" : "AJOUTER LA VIDÉO"}
              </button>
              <button type="button" onClick={reset} className="btn-ghost" aria-label="Annuler">
                Annuler
              </button>
            </div>
          )}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />

      {error ? (
        <p
          className={cx(
            "animate-pop mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300"
          )}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
