"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { cx, formatPoints, validateVideoFile } from "@/lib/utils";

type Phase = "idle" | "uploading" | "done";

export function SubmitPanel({
  challengeId,
  teamId,
  studentId,
  videoRequired,
  points,
  lastRejection,
}: {
  challengeId: string;
  teamId: string;
  studentId: string;
  videoRequired: boolean;
  points: number;
  lastRejection: { reason: string | null; date: string } | null;
}) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setPhase("idle");
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload() {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    setProgress(0);

    try {
      const { data: sub, error: subError } = await supabase
        .from("submissions")
        .insert({
          challenge_id: challengeId,
          team_id: teamId,
          submitted_by: studentId,
          status: "pending",
        })
        .select("id")
        .single();
      if (subError) throw subError;

      const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase();
      const path = `${teamId}/${challengeId}/${sub.id}.${ext}`;

      // Upload via XHR pour suivre la progression (l'API REST Storage avec le
      // JWT de l'utilisateur applique les mêmes policies RLS que supabase-js).
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Session expirée, reconnecte-toi.");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/challenge-submissions/${path}`
        );
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Échec de l'envoi (HTTP ${xhr.status}).`));
        };
        xhr.onerror = () =>
          reject(new Error("Upload interrompu. Vérifie ta connexion et réessaie."));
        xhr.send(file);
      });

      const { error: updError } = await supabase
        .from("submissions")
        .update({ video_path: path })
        .eq("id", sub.id);
      if (updError) throw updError;

      setProgress(100);
      setPhase("done");
      router.refresh();
    } catch (err) {
      setPhase("idle");
      const message = (err as Error).message || "Une erreur est survenue.";
      if (message.includes("row-level security")) {
        setError("Vous n'avez pas les permissions nécessaires.");
      } else if (message.includes("already") || message.includes("duplicate")) {
        setError("Ce défi est déjà en attente de validation.");
      } else {
        setError(message);
      }
    }
  }

  const sizeMb = file ? (file.size / (1024 * 1024)).toFixed(1) : null;

  if (phase === "done") {
    return (
      <div className="card animate-pop border-emerald-500/40 bg-emerald-500/10 p-6 text-center">
        <span className="text-5xl" aria-hidden>
          🚀
        </span>
        <p className="mt-3 text-lg font-bold text-emerald-300">
          Preuve envoyée !
        </p>
        <p className="mt-1 text-sm text-emerald-200/70">
          Le défi passe en attente de validation. Les{" "}
          {formatPoints(points)} points seront crédités après validation.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="font-extrabold text-white">🎥 Preuve vidéo</h2>
      <p className="mt-1 text-sm text-zinc-400">
        {videoRequired
          ? "Envoie une vidéo qui prouve que le défi est réalisé."
          : "Vidéo facultative pour ce défi, mais elle accélère la validation."}
      </p>

      {lastRejection ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
          <p className="font-semibold text-red-300">❌ Tentative précédente refusée</p>
          <p className="mt-1 text-red-200/80">
            Raison : {lastRejection.reason ?? "non communiquée"}
          </p>
        </div>
      ) : null}

      {!file ? (
        <div
          className={cx(
            "mt-4 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition",
            dragOver
              ? "border-violet-500 bg-violet-500/10"
              : "border-white/15 bg-white/[0.02]"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <span className="text-4xl" aria-hidden>
            📹
          </span>
          <p className="mt-2 hidden text-sm text-zinc-400 md:block">
            Glissez votre vidéo ici
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            MP4, MOV ou WebM · 150 Mo max
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-ghost mt-4 text-sm"
          >
            Choisir une vidéo
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>
      ) : (
        <div className="mt-4">
          <video
            src={previewUrl ?? undefined}
            controls
            className="max-h-72 w-full rounded-2xl bg-black"
          />
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="truncate text-zinc-300">{file.name}</span>
            <span className="ml-2 shrink-0 text-zinc-500">{sizeMb} Mo</span>
          </div>

          {phase === "uploading" ? (
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
              <button onClick={upload} className="btn-primary flex-1">
                ENVOYER LA PREUVE
              </button>
              <button type="button" onClick={reset} className="btn-ghost">
                🗑️
              </button>
            </div>
          )}
        </div>
      )}

      {error ? (
        <p className="animate-pop mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
