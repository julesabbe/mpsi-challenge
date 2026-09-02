"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { studentName } from "@/lib/utils";
import type { Student } from "@/lib/types";

// (Row type includes joined team info)

type Row = Student & { team: string | null; linked: boolean };

export function StudentsManager({
  students,
  teamByStudent,
  linkedAuthIds,
}: {
  students: Student[];
  teamByStudent: Record<string, string | null>;
  linkedAuthIds: Set<string>;
}) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const rows: Row[] = useMemo(
    () =>
      students.map((s) => ({
        ...s,
        team: teamByStudent[s.id] ?? null,
        linked: linkedAuthIds.has(s.id),
      })),
    [students, teamByStudent, linkedAuthIds]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => studentName(r).toLowerCase().includes(q));
  }, [rows, query]);

  function openCreate() {
    setEditing(null);
    setFirstName("");
    setLastName("");
    setActive(true);
    setError(null);
    setShowForm(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setFirstName(s.first_name);
    setLastName(s.last_name ?? "");
    setActive(s.active);
    setError(null);
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim()) {
      setError("Le prénom est obligatoire.");
      return;
    }
    setBusy(true);
    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      active,
    };
    const { error } = editing
      ? await supabase.from("students").update(payload).eq("id", editing.id)
      : await supabase.from("students").insert(payload);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function remove(s: Row) {
    setToDelete(null);
    setBusy(true);
    const { error } = await supabase.from("students").delete().eq("id", s.id);
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("foreign key") ||
          error.message.includes("linked") ||
          error.code === "23503"
          ? "Impossible de supprimer cet élève (liée à un compte ou à des données). Désactivez-le plutôt."
          : error.message
      );
      return;
    }
    router.refresh();
  }

  async function toggleActive(s: Student) {
    setBusy(true);
    await supabase.from("students").update({ active: !s.active }).eq("id", s.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input-base max-w-xs flex-1"
          placeholder="Rechercher un élève…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={openCreate} className="btn-primary w-auto px-5">
          + Ajouter un élève
        </button>
      </div>

      {error && !showForm ? (
        <p className="animate-pop mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Équipe</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Compte</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 font-semibold text-white">
                  {studentName(s)}
                </td>
                <td className="px-4 py-3 text-zinc-300">{s.team ?? "—"}</td>
                <td className="px-4 py-3">
                  {s.active ? (
                    <span className="text-emerald-300">Actif</span>
                  ) : (
                    <span className="text-zinc-500">Inactif</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {s.linked ? "🔗 Lié" : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2 text-xs font-semibold">
                    <button
                      onClick={() => openEdit(s)}
                      className="rounded-lg bg-white/5 px-2.5 py-1.5 text-zinc-300 hover:bg-white/10"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => toggleActive(s)}
                      className="rounded-lg bg-white/5 px-2.5 py-1.5 text-zinc-300 hover:bg-white/10"
                    >
                      {s.active ? "Désactiver" : "Réactiver"}
                    </button>
                    <button
                      onClick={() => setToDelete(s)}
                      className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-red-300 hover:bg-red-500/20"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500">
            Aucun élève trouvé.
          </p>
        ) : null}
      </div>

      {/* Formulaire création / édition */}
      {showForm ? (
        <form
          onSubmit={save}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="card animate-pop w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-white">
              {editing ? "Modifier l'élève" : "Nouvel élève"}
            </h3>
            <div className="mt-4 space-y-3">
              <input
                className="input-base"
                placeholder="Prénom *"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className="input-base"
                placeholder="Nom (facultatif)"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 accent-violet-500"
                />
                Élève actif (visible dans l&apos;onboarding)
              </label>
            </div>
            {error ? (
              <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={busy} className="btn-primary flex-1">
                {busy ? "…" : editing ? "ENREGISTRER" : "CRÉER"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-ghost flex-1"
              >
                Annuler
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer cet élève ?"
        message={`« ${toDelete ? studentName(toDelete) : ""} » sera définitivement supprimé${
          toDelete?.team ? " ainsi que son appartenance à une équipe" : ""
        }. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove(toDelete)}
      />
    </div>
  );
}
