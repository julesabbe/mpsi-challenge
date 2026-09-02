"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { cx, formatPoints, formatDate } from "@/lib/utils";
import { DIFFICULTY_LABELS, type Submission } from "@/lib/types";

type Tab = "pending" | "approved" | "rejected";

const TABS: Array<{ id: Tab; label: string; emoji: string }> = [
  { id: "pending", label: "En attente", emoji: "🟡" },
  { id: "approved", label: "Validées", emoji: "🟢" },
  { id: "rejected", label: "Refusées", emoji: "🔴" },
];

export function SubmissionsManager({
  submissions,
}: {
  submissions: Submission[];
}) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [reason, setReason] = useState("");
  const [playing, setPlaying] = useState<{
    submission: Submission;
    url: string;
  } | null>(null);
  const [loadingVideo, setLoadingVideo] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<Submission | null>(null);

  const counts = {
    pending: submissions.filter((s) => s.status === "pending").length,
    approved: submissions.filter((s) => s.status === "approved").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
  };
  const list = submissions.filter((s) => s.status === tab);

  async function openVideo(s: Submission) {
    setError(null);
    setLoadingVideo(s.id);
    const { data, error } = await supabase.storage
      .from("challenge-submissions")
      .createSignedUrl(s.video_path, 3600);
    setLoadingVideo(null);
    if (error || !data) {
      setError("Impossible de charger la vidéo : " + (error?.message ?? ""));
      return;
    }
    setPlaying({ submission: s, url: data.signedUrl });
  }

  async function approve(s: Submission) {
    setConfirmApprove(null);
    setBusyId(s.id);
    setError(null);
    const { error } = await supabase.rpc("review_submission_rpc", {
      p_submission_id: s.id,
      p_approve: true,
    });
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  async function reject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    setError(null);
    const { error } = await supabase.rpc("review_submission_rpc", {
      p_submission_id: rejecting.id,
      p_approve: false,
      p_rejection_reason: reason.trim() || null,
    });
    setBusyId(null);
    setRejecting(null);
    setReason("");
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-5">
      {/* Onglets */}
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cx(
              "flex-1 rounded-2xl px-3 py-2.5 text-sm font-bold transition",
              tab === t.id
                ? "bg-violet-500 text-white"
                : "bg-white/5 text-zinc-400 hover:bg-white/10"
            )}
          >
            {t.emoji} {t.label} ({counts[t.id]})
          </button>
        ))}
      </div>

      {error ? (
        <p className="animate-pop mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {list.length === 0 ? (
          <EmptyState
            icon={tab === "pending" ? "📭" : tab === "approved" ? "✅" : "🗑️"}
            title={
              tab === "pending"
                ? "Aucune soumission en attente."
                : tab === "approved"
                  ? "Aucune soumission validée pour l'instant."
                  : "Aucune soumission refusée pour l'instant."
            }
          />
        ) : null}

        {list.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">
                  {s.teams?.emoji} {s.teams?.name ?? "Équipe"}
                </p>
                <p className="mt-0.5 text-sm text-zinc-300">
                  {s.challenges?.title ?? "Défi"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Soumis par {s.students?.first_name ?? "?"} ·{" "}
                  {formatDate(s.submitted_at)} ·{" "}
                  <span className="font-semibold text-violet-300">
                    +{formatPoints(s.challenges?.points ?? 0)} pts
                  </span>{" "}
                  · {DIFFICULTY_LABELS[s.challenges?.difficulty ?? "easy"]}
                </p>
                {s.status === "rejected" && s.rejection_reason ? (
                  <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    Raison du refus : {s.rejection_reason}
                  </p>
                ) : null}
                {s.status === "approved" && s.reviewed_at ? (
                  <p className="mt-2 text-xs text-emerald-300">
                    ✅ Validé le {formatDate(s.reviewed_at)} — points crédités
                  </p>
                ) : null}
              </div>

              <div className="flex w-full flex-col gap-2 md:w-auto">
                <button
                  type="button"
                  onClick={() => openVideo(s)}
                  disabled={loadingVideo === s.id}
                  className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-50"
                >
                  {loadingVideo === s.id ? "Chargement…" : "▶ VOIR LA VIDÉO"}
                </button>
                {s.status === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmApprove(s)}
                      disabled={busyId === s.id}
                      className="flex-1 rounded-2xl bg-emerald-500/90 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      ✅ VALIDER
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejecting(s);
                        setReason("");
                      }}
                      disabled={busyId === s.id}
                      className="flex-1 rounded-2xl bg-red-500/90 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
                    >
                      ❌ REFUSER
                    </button>
                  </div>
                ) : null}
              </div>
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
                {playing.submission.teams?.name} ·{" "}
                {playing.submission.challenges?.title}
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

      {/* Refus avec raison */}
      {rejecting ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setRejecting(null)}
        >
          <div
            className="card animate-pop w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-white">
              ❌ Refuser ce défi ?
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              {rejecting.teams?.name} · {rejecting.challenges?.title}
            </p>
            <label className="mb-1 mt-4 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Raison du refus
            </label>
            <textarea
              className="input-base min-h-24"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="La vidéo ne permet pas de vérifier le défi…"
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                "La vidéo ne permet pas de vérifier le défi.",
                "Le défi n'est pas réalisé conformément aux règles.",
                "Vidéo illisible ou corrompue.",
              ].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-400 hover:bg-white/10"
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={reject}
                disabled={busyId === rejecting.id}
                className="flex-1 rounded-2xl bg-red-500/90 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                CONFIRMER LE REFUS
              </button>
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="btn-ghost flex-1"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirmation validation */}
      <ConfirmDialog
        open={confirmApprove !== null}
        title="Valider ce défi ?"
        message={`+${formatPoints(
          confirmApprove?.challenges?.points ?? 0
        )} points seront crédités à ${
          confirmApprove?.teams?.name ?? "l'équipe"
        }. Cette action crédite les points une seule fois.`}
        confirmLabel="✅ Valider"
        danger={false}
        onCancel={() => setConfirmApprove(null)}
        onConfirm={() => confirmApprove && approve(confirmApprove)}
      />
    </div>
  );
}
