"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";

export type GodparentCandidate = { id: string; name: string };

export function GodparentPicker({
  teamId,
  chosen,
  candidates,
  canChoose,
  isAdmin,
}: {
  teamId: string;
  chosen: { id: string; name: string } | null;
  candidates: GodparentCandidate[];
  canChoose: boolean;
  isAdmin?: boolean;
}) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmChoose() {
    if (!pendingId) return;
    setError(null);
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("choose_godparent", {
      p_team_id: teamId,
      p_mp_psi_id: pendingId,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setPendingId(null);
    router.refresh();
  }

  async function reset() {
    setError(null);
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("admin_reset_godparent", {
      p_team_id: teamId,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-extrabold text-white">🕊️ Parrain de l&apos;équipe</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Les MP/PSI qui se proposent pour accompagner votre équipe.
          </p>
        </div>
        {chosen && isAdmin ? (
          <button
            type="button"
            disabled={busy}
            onClick={reset}
            className="shrink-0 text-xs font-semibold text-zinc-500 hover:text-red-300"
          >
            Réinitialiser (admin)
          </button>
        ) : null}
      </div>

      {chosen ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="font-bold text-emerald-300">
            🕊️ Votre parrain : {chosen.name}
          </p>
          <p className="mt-1 text-sm text-emerald-200/70">
            Choix définitif — ce parrain accompagne votre équipe durant tout le
            challenge.
          </p>
        </div>
      ) : canChoose && candidates.length > 0 ? (
        <div className="mt-4 space-y-2">
          {candidates.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
                {c.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-white">
                {c.name}
              </span>
              {pendingId !== c.id ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setPendingId(c.id);
                  }}
                  className="shrink-0 rounded-full bg-violet-500/90 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-violet-500"
                >
                  Choisir
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : canChoose ? (
        <p className="mt-4 rounded-2xl bg-white/[0.03] px-3 py-4 text-center text-sm text-zinc-500">
          Aucun MP/PSI ne s&apos;est encore proposé pour votre équipe.
        </p>
      ) : null}

      {pendingId ? (
        <div className="animate-pop mt-4 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4">
          <p className="font-bold text-amber-300">⚠️ Choix définitif</p>
          <p className="mt-1 text-sm text-amber-200/80">
            Une fois confirmé, le parrain sera attribué à votre équipe sans
            possibilité de retour (hors intervention du Super Admin). Voulez-vous
            vraiment choisir ce parrain ?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={confirmChoose}
              className="flex-1 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-black text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {busy ? "Confirmation…" : "✅ CONFIRMER DÉFINITIVEMENT"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPendingId(null)}
              className="rounded-2xl bg-white/5 px-4 text-sm font-semibold text-zinc-300"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="animate-pop mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
