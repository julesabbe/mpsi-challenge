"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { TEAM_EMOJIS, type Student } from "@/lib/types";
import { cx, formatPoints, ordinalRank, studentName } from "@/lib/utils";
import type { TeamScore } from "@/lib/types";

export function TeamsManager({
  rows,
  students,
}: {
  rows: TeamScore[];
  students: Student[];
}) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TeamScore | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("⚡");
  const [addingFor, setAddingFor] = useState<TeamScore | null>(null);
  const [toDissolve, setToDissolve] = useState<TeamScore | null>(null);
  const [removing, setRemoving] = useState<{
    team: TeamScore;
    studentId: string;
    name: string;
  } | null>(null);

  const teamedIds = useMemo(
    () => new Set(rows.flatMap((r) => r.members.map((m) => m.id))),
    [rows]
  );
  const availableStudents = students.filter((s) => !teamedIds.has(s.id));

  async function saveTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase
      .from("teams")
      .update({ name: editName.trim(), emoji: editEmoji })
      .eq("id", editing.team.id);
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("duplicate")
          ? "Ce nom d'équipe est déjà pris."
          : error.message
      );
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function addMember(team: TeamScore, studentId: string) {
    setError(null);
    setBusy(true);
    const { error } = await supabase
      .from("team_members")
      .insert({ team_id: team.team.id, student_id: studentId });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("duplicate") || error.code === "23505"
          ? "Cet élève appartient déjà à une équipe."
          : error.message
      );
      return;
    }
    setAddingFor(null);
    router.refresh();
  }

  async function removeMember() {
    if (!removing) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", removing.team.team.id)
      .eq("student_id", removing.studentId);
    setBusy(false);
    setRemoving(null);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  async function dissolve() {
    if (!toDissolve) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("id", toDissolve.team.id);
    setBusy(false);
    setToDissolve(null);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="mt-5">
        <EmptyState
          icon="🏆"
          title="Aucune équipe pour le moment"
          hint="Les équipes apparaîtront dès que les élèves se seront associés."
        />
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      {error ? (
        <p className="animate-pop rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {rows.map((row) => (
        <div key={row.team.id} className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-8 text-center font-black text-zinc-500">
              {ordinalRank(row.rank ?? 0)}
            </span>
            <span className="text-2xl" aria-hidden>
              {row.team.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-white">{row.team.name}</p>
              <p className="text-xs text-zinc-500">
                {row.validatedCount} défis validés · {row.pendingCount} en
                attente
              </p>
            </div>
            <div className="text-right">
              <p className="font-black text-violet-300">
                {formatPoints(row.points)}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                points
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {row.members.map((m) => (
              <span
                key={m.id}
                className="group flex items-center gap-1.5 rounded-full bg-white/5 py-1 pl-3 pr-1.5 text-sm text-zinc-200"
              >
                👤 {studentName(m)}
                <button
                  type="button"
                  onClick={() =>
                    setRemoving({ team: row, studentId: m.id, name: studentName(m) })
                  }
                  className="rounded-full px-1.5 text-zinc-500 transition hover:bg-red-500/20 hover:text-red-300"
                  aria-label={`Retirer ${studentName(m)}`}
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setAddingFor(row)}
              className="rounded-full border border-dashed border-white/20 px-3 py-1 text-sm text-zinc-400 transition hover:border-violet-500/50 hover:text-violet-300"
            >
              + Ajouter
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(row);
                setEditName(row.team.name);
                setEditEmoji(row.team.emoji);
                setError(null);
              }}
              className="rounded-xl bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10"
            >
              ✏️ Renommer
            </button>
            <button
              type="button"
              onClick={() => setToDissolve(row)}
              className="rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
            >
              💥 Dissoudre
            </button>
          </div>
        </div>
      ))}

      {availableStudents.length > 0 ? (
        <p className="text-xs text-zinc-600">
          💡 {availableStudents.length} élève(s) sans équipe :{" "}
          {availableStudents.map((s) => studentName(s)).join(", ")}
        </p>
      ) : null}

      {/* Renommer */}
      {editing ? (
        <form
          onSubmit={saveTeam}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="card animate-pop w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-white">
              Modifier l&apos;équipe
            </h3>
            <input
              className="input-base mt-4"
              value={editName}
              maxLength={40}
              onChange={(e) => setEditName(e.target.value)}
            />
            <div className="mt-3 grid grid-cols-8 gap-1.5">
              {TEAM_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEditEmoji(e)}
                  className={cx(
                    "flex h-9 items-center justify-center rounded-lg text-lg transition",
                    editEmoji === e
                      ? "bg-violet-500/25 ring-2 ring-violet-500"
                      : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={busy} className="btn-primary flex-1">
                ENREGISTRER
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="btn-ghost flex-1"
              >
                Annuler
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {/* Ajouter un membre */}
      {addingFor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setAddingFor(null)}
        >
          <div
            className="card animate-pop w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-white">
              Ajouter à {addingFor.team.name}
            </h3>
            {availableStudents.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-400">
                Tous les élèves actifs ont déjà une équipe.
              </p>
            ) : (
              <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {availableStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={busy}
                    onClick={() => addMember(addingFor, s.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left text-sm font-medium text-white transition hover:border-violet-500/40 disabled:opacity-50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                      {s.first_name.charAt(0)}
                    </span>
                    {studentName(s)}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setAddingFor(null)}
              className="btn-ghost mt-4 w-full"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title="Retirer ce membre ?"
        message={`« ${removing?.name ?? ""} » ne fera plus partie de ${
          removing?.team.team.name ?? ""
        }. Il/elle pourra rejoindre une autre équipe.`}
        confirmLabel="Retirer"
        onCancel={() => setRemoving(null)}
        onConfirm={removeMember}
      />

      <ConfirmDialog
        open={toDissolve !== null}
        title="Dissoudre cette équipe ?"
        message={`« ${
          toDissolve?.team.name ?? ""
        } » sera supprimée avec ses membres associés. Cette action est irréversible.`}
        confirmLabel="Dissoudre"
        onCancel={() => setToDissolve(null)}
        onConfirm={dissolve}
      />
    </div>
  );
}
