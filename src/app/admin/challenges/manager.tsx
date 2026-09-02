"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  DIFFICULTY_EMOJI,
  DIFFICULTY_LABELS,
  type Category,
  type Challenge,
  type Difficulty,
} from "@/lib/types";
import { formatPoints } from "@/lib/utils";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "extreme"];
const CATS: Category[] = ["social", "sport", "creative", "school", "funny", "team"];

const EMPTY = {
  title: "",
  description: "",
  points: 100,
  difficulty: "easy" as Difficulty,
  category: "team" as Category,
  video_required: true,
  active: true,
};

export function ChallengesManager({ challenges }: { challenges: Challenge[] }) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Challenge | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return challenges;
    return challenges.filter(
      (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }, [challenges, query]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setError(null);
    setShowForm(true);
  }

  function openEdit(c: Challenge) {
    setEditing(c);
    setForm({
      title: c.title,
      description: c.description,
      points: c.points,
      difficulty: c.difficulty,
      category: c.category,
      video_required: c.video_required,
      active: c.active,
    });
    setError(null);
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError("Le nom du défi est obligatoire.");
      return;
    }
    if (!Number.isFinite(form.points) || form.points <= 0) {
      setError("Les points doivent être un nombre positif.");
      return;
    }
    setBusy(true);
    const payload = { ...form, title: form.title.trim(), points: Number(form.points) };
    const { error } = editing
      ? await supabase.from("challenges").update(payload).eq("id", editing.id)
      : await supabase.from("challenges").insert(payload);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function toggleActive(c: Challenge) {
    setBusy(true);
    await supabase.from("challenges").update({ active: !c.active }).eq("id", c.id);
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!toDelete) return;
    setBusy(true);
    const { error } = await supabase.from("challenges").delete().eq("id", toDelete.id);
    setBusy(false);
    setToDelete(null);
    if (error) {
      setError(
        "Impossible de supprimer ce défi (des soumissions y sont liées). Désactivez-le plutôt."
      );
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input-base max-w-xs flex-1"
          placeholder="Rechercher un défi…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={openCreate} className="btn-primary w-auto px-5">
          + Créer un défi
        </button>
      </div>

      {error && !showForm ? (
        <p className="animate-pop mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {filtered.map((c) => (
          <div key={c.id} className={cxCard(c.active)}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                {CATEGORY_EMOJI[c.category]} {CATEGORY_LABELS[c.category]}
              </p>
              <span className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-2.5 py-1 text-xs font-black text-white">
                +{formatPoints(c.points)}
              </span>
            </div>
            <h3 className="mt-2 font-bold text-white">{c.title}</h3>
            {c.description ? (
              <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                {c.description}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-300">
                {DIFFICULTY_EMOJI[c.difficulty]} {DIFFICULTY_LABELS[c.difficulty]}
              </span>
              {c.video_required ? (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-300">
                  🎥 vidéo req.
                </span>
              ) : null}
              <span
                className={
                  c.active
                    ? "rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300"
                    : "rounded-full bg-zinc-500/15 px-2.5 py-1 text-zinc-400"
                }
              >
                {c.active ? "Actif" : "Inactif"}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => openEdit(c)}
                className="rounded-xl bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10"
              >
                ✏️ Modifier
              </button>
              <button
                type="button"
                onClick={() => toggleActive(c)}
                className="rounded-xl bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10"
              >
                {c.active ? "⏸️ Désactiver" : "▶️ Réactiver"}
              </button>
              <button
                type="button"
                onClick={() => setToDelete(c)}
                className="rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card mt-4 p-8 text-center text-sm text-zinc-500">
          Aucun défi trouvé.
        </div>
      ) : null}

      {/* Formulaire */}
      {showForm ? (
        <form
          onSubmit={save}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="card animate-pop my-8 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-white">
              {editing ? "Modifier le défi" : "Nouveau défi"}
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  Nom du défi *
                </label>
                <input
                  className="input-base"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Chanter dans la rue"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  Description
                </label>
                <textarea
                  className="input-base min-h-24"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Décris précisément ce qui est attendu…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                    Points *
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="input-base"
                    value={form.points}
                    onChange={(e) =>
                      setForm({ ...form, points: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                    Difficulté
                  </label>
                  <select
                    className="input-base"
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm({ ...form, difficulty: e.target.value as Difficulty })
                    }
                  >
                    {DIFFS.map((d) => (
                      <option key={d} value={d}>
                        {DIFFICULTY_EMOJI[d]} {DIFFICULTY_LABELS[d]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  Catégorie
                </label>
                <select
                  className="input-base"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as Category })
                  }
                >
                  {CATS.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_EMOJI[c]} {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.video_required}
                  onChange={(e) =>
                    setForm({ ...form, video_required: e.target.checked })
                  }
                  className="h-4 w-4 accent-violet-500"
                />
                Vidéo obligatoire
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 accent-violet-500"
                />
                Défi actif
              </label>
            </div>
            {error ? (
              <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={busy} className="btn-primary flex-1">
                {busy ? "…" : editing ? "ENREGISTRER" : "CRÉER LE DÉFI"}
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
        title="Supprimer ce défi ?"
        message={`« ${toDelete?.title ?? ""} » sera définitivement supprimé. Si des soumissions y sont liées, la suppression échouera : désactivez-le plutôt.`}
        confirmLabel="Supprimer"
        onCancel={() => setToDelete(null)}
        onConfirm={remove}
      />
    </div>
  );
}

function cxCard(active: boolean) {
  return `card animate-rise p-4 ${active ? "" : "opacity-60"}`;
}
