"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/utils";
import { VIDEO_BUCKET } from "@/lib/upload-video";

export type PresentationRow = {
  teamId: string;
  teamName: string;
  teamEmoji: string;
  members: string[];
  videoPath: string | null;
  uploadedAt: string | null;
  godparentName: string | null;
};

/**
 * Vue Super Admin des vidéos de présentation d'équipe.
 *
 * Contrairement aux preuves de défi, ces vidéos ne sont PAS soumises à
 * validation : elles servent au choix du parrain par les MP/PSI. Le Super
 * Admin n'a donc pas de bouton Accepter/Refuser — seulement de quoi
 * visionner et retirer une vidéo inappropriée.
 */
export function AdminPresentations({ rows }: { rows: PresentationRow[] }) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [playing, setPlaying] = useState<{ name: string; url: string } | null>(
    null
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<PresentationRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const published = rows.filter((r) => r.videoPath).length;

  async function openVideo(row: PresentationRow) {
    if (!row.videoPath) return;
    setError(null);
    setNotice(null);
    setLoadingId(row.teamId);
    const { data, error: signError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(row.videoPath, 3600);
    setLoadingId(null);
    if (signError || !data) {
      setError(
        "Impossible de charger la vidéo : " + (signError?.message ?? "lien refusé")
      );
      return;
    }
    setPlaying({ name: `${row.teamEmoji} ${row.teamName}`, url: data.signedUrl });
  }

  async function remove() {
    if (!toRemove) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    // 1) Détacher la vidéo côté base : la fonction renvoie l'ancien chemin.
    const { data, error: rpcError } = await supabase.rpc(
      "admin_clear_team_presentation",
      { p_team_id: toRemove.teamId }
    );

    // 2) Supprimer le fichier du bucket (best-effort : la référence est déjà
    //    retirée, un échec ne laisse qu'un objet orphelin invisible).
    let storageFailed = false;
    if (!rpcError && data) {
      const { error: storageError } = await supabase.storage
        .from(VIDEO_BUCKET)
        .remove([data as string]);
      storageFailed = Boolean(storageError);
    }

    setBusy(false);
    setToRemove(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (storageFailed) {
      setNotice(
        "Vidéo retirée de l'équipe, mais le fichier n'a pas pu être supprimé du stockage. Relance le retrait pour réessayer."
      );
    }
    router.refresh();
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">
            🎬 Présentations d&apos;équipe
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Les vidéos de présentation servent au choix du parrain par les
            MP/PSI. Elles ne demandent aucune validation — tu peux seulement les
            visionner ou en retirer une.
          </p>
        </div>
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">
          {`${published} / ${rows.length} vidéo${published === 1 ? "" : "s"} publiée${published === 1 ? "" : "s"}`}
        </span>
      </div>

      {error ? (
        <p className="animate-pop mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="animate-pop mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {notice}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <EmptyState
            icon="🏆"
            title="Aucune équipe formée pour l'instant."
            hint="Les présentations apparaîtront ici dès que les équipes auront publié leur vidéo."
          />
        ) : null}

        {rows.map((row) => (
          <div key={row.teamId} className="card p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">
                  {row.teamEmoji} {row.teamName}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {row.members.length > 0
                    ? row.members.join(" · ")
                    : "Aucun membre"}
                </p>
                <p className="mt-1 text-xs">
                  {row.godparentName ? (
                    <span className="text-sky-300">
                      🕊️ Parrain : {row.godparentName}
                    </span>
                  ) : (
                    <span className="text-zinc-500">🕊️ Aucun parrain choisi</span>
                  )}
                </p>
                {row.videoPath && row.uploadedAt ? (
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Vidéo publiée le {formatDate(row.uploadedAt)}
                  </p>
                ) : null}
                {!row.videoPath ? (
                  <p className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-zinc-500">
                    Aucune vidéo de présentation publiée.
                  </p>
                ) : null}
              </div>

              {row.videoPath ? (
                <div className="flex w-full gap-2 md:w-auto">
                  <button
                    type="button"
                    onClick={() => openVideo(row)}
                    disabled={loadingId === row.teamId}
                    className="flex-1 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-50 md:flex-none"
                  >
                    {loadingId === row.teamId ? "Chargement…" : "▶ VOIR LA VIDÉO"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setToRemove(row);
                    }}
                    disabled={busy}
                    className="flex-1 rounded-2xl bg-red-500/90 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50 md:flex-none"
                  >
                    🗑️ RETIRER
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Lecteur vidéo */}
      {playing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPlaying(null)}
        >
          <div
            className="animate-pop w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-bold text-white">
                {playing.name} · Présentation
              </p>
              <button
                type="button"
                onClick={() => setPlaying(null)}
                className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
              >
                ✕
              </button>
            </div>
            <video
              src={playing.url}
              controls
              autoPlay
              className="max-h-[70vh] w-full rounded-3xl bg-black"
            />
          </div>
        </div>
      ) : null}

      {/* Confirmation de retrait */}
      <ConfirmDialog
        open={toRemove !== null}
        title="Retirer cette vidéo de présentation ?"
        message={`La vidéo de ${toRemove?.teamName ?? "cette équipe"} sera supprimée et n'apparaîtra plus dans le vote des MP/PSI. Cette action est définitive : l'équipe devra publier une nouvelle vidéo.`}
        confirmLabel="🗑️ RETIRER"
        danger
        onCancel={() => setToRemove(null)}
        onConfirm={remove}
      />
    </section>
  );
}
