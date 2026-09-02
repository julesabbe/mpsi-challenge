"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { formatPoints, timeAgo } from "@/lib/utils";
import type { PointTransaction, TeamScore } from "@/lib/types";

const TYPE_META: Record<
  PointTransaction["type"],
  { label: string; emoji: string; color: string }
> = {
  challenge: { label: "Défi", emoji: "🎯", color: "text-violet-300" },
  bonus: { label: "Bonus", emoji: "⭐", color: "text-emerald-300" },
  penalty: { label: "Malus", emoji: "⚠️", color: "text-red-300" },
  manual_adjustment: { label: "Ajustement", emoji: "🛠️", color: "text-amber-300" },
};

export function PointsManager({
  rows,
  transactions,
}: {
  rows: TeamScore[];
  transactions: PointTransaction[];
}) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [teamId, setTeamId] = useState("");
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"bonus" | "penalty">("bonus");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingOp, setPendingOp] = useState<{
    amount: number;
    teamName: string;
    reason: string;
  } | null>(null);

  async function apply() {
    if (!pendingOp) return;
    setBusy(true);
    const { error } = await supabase.from("point_transactions").insert({
      team_id: teamId,
      amount: pendingOp.amount,
      type: mode,
      reason: pendingOp.reason,
    });
    setBusy(false);
    setPendingOp(null);
    if (error) {
      setFeedback("❌ " + error.message);
      return;
    }
    setFeedback(
      mode === "bonus"
        ? `✅ +${formatPoints(pendingOp.amount)} points attribués à ${pendingOp.teamName}.`
        : `✅ ${formatPoints(pendingOp.amount)} points retirés à ${pendingOp.teamName}.`
    );
    setReason("");
    router.refresh();
  }

  const selectedTeam = rows.find((r) => r.team.id === teamId);

  return (
    <div className="mt-5">
      <div className="card p-5">
        <h2 className="font-extrabold text-white">Ajouter / retirer des points</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-3">
            <select
              className="input-base"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">Choisir une équipe…</option>
              {rows.map((r) => (
                <option key={r.team.id} value={r.team.id}>
                  {r.team.emoji} {r.team.name} ({formatPoints(r.points)} pts)
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("bonus")}
                className={
                  mode === "bonus"
                    ? "flex-1 rounded-2xl bg-emerald-500/90 px-3 py-2.5 text-sm font-bold text-white"
                    : "flex-1 rounded-2xl bg-white/5 px-3 py-2.5 text-sm font-semibold text-zinc-400"
                }
              >
                ⭐ Bonus
              </button>
              <button
                type="button"
                onClick={() => setMode("penalty")}
                className={
                  mode === "penalty"
                    ? "flex-1 rounded-2xl bg-red-500/90 px-3 py-2.5 text-sm font-bold text-white"
                    : "flex-1 rounded-2xl bg-white/5 px-3 py-2.5 text-sm font-semibold text-zinc-400"
                }
              >
                ⚠️ Malus
              </button>
            </div>

            <input
              type="number"
              min={1}
              className="input-base"
              placeholder="Nombre de points"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              className="input-base"
              placeholder="Raison (ex : comportement exemplaire)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <button
              type="button"
              disabled={!teamId || !amount || busy}
              onClick={() => {
                const n = Math.abs(Math.round(Number(amount)));
                if (!n || !selectedTeam) return;
                setPendingOp({
                  amount: n,
                  teamName: selectedTeam.team.name,
                  reason: reason.trim(),
                });
              }}
              className="btn-primary"
            >
              {mode === "bonus" ? "ATTRIBUER" : "RETIRER"}
            </button>
          </div>

          <div className="rounded-2xl bg-white/[0.03] p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              Aperçu
            </p>
            {selectedTeam ? (
              <div className="mt-2 text-sm text-zinc-300">
                <p className="font-semibold text-white">
                  {selectedTeam.team.emoji} {selectedTeam.team.name}
                </p>
                <p className="mt-1">
                  Score actuel :{" "}
                  <span className="font-bold text-violet-300">
                    {formatPoints(selectedTeam.points)} pts
                  </span>
                </p>
                {amount && Number(amount) > 0 ? (
                  <p className="mt-1">
                    {mode === "bonus" ? "Après bonus" : "Après malus"} :{" "}
                    <span className="font-bold text-white">
                      {formatPoints(
                        mode === "bonus"
                          ? selectedTeam.points + Number(amount)
                          : selectedTeam.points - Number(amount)
                      )}{" "}
                      pts
                    </span>
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-zinc-500">
                  {selectedTeam.rank === 1 ? "👑" : `#${selectedTeam.rank}`} ·{" "}
                  {selectedTeam.validatedCount} défis validés
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">
                Sélectionnez une équipe pour voir l&apos;aperçu.
              </p>
            )}
          </div>
        </div>

        {feedback ? (
          <p className="animate-pop mt-4 rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-200">
            {feedback}
          </p>
        ) : null}
      </div>

      <h2 className="mb-3 mt-6 font-extrabold text-white">
        Historique des transactions
      </h2>
      {transactions.length === 0 ? (
        <EmptyState
          icon="💰"
          title="Aucune transaction pour l'instant"
          hint="Les points apparaîtront ici dès les premières validations."
        />
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => {
            const meta = TYPE_META[t.type];
            const team = rows.find((r) => r.team.id === t.team_id);
            return (
              <div key={t.id} className="card flex items-center gap-3 px-4 py-3">
                <span aria-hidden>{meta.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {team?.team.name ?? "Équipe supprimée"}{" "}
                    <span className="font-normal text-zinc-500">
                      · {meta.label}
                    </span>
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {t.reason || "—"} · {timeAgo(t.created_at)}
                  </p>
                </div>
                <span
                  className={
                    t.amount >= 0
                      ? "font-black text-emerald-300"
                      : "font-black text-red-300"
                  }
                >
                  {t.amount >= 0 ? "+" : ""}
                  {formatPoints(t.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingOp !== null}
        title={mode === "bonus" ? "Attribuer des points ?" : "Retirer des points ?"}
        message={
          pendingOp
            ? `Êtes-vous sûr de vouloir ${
                mode === "bonus" ? "attribuer" : "retirer"
              } ${formatPoints(pendingOp.amount)} points ${
                mode === "bonus" ? "à" : "à"
              } ${pendingOp.teamName}${
                pendingOp.reason ? ` (raison : « ${pendingOp.reason} »)` : ""
              } ?`
            : ""
        }
        confirmLabel="Confirmer"
        danger={mode === "penalty"}
        onCancel={() => setPendingOp(null)}
        onConfirm={apply}
      />
    </div>
  );
}
