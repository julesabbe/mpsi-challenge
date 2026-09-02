"use client";

import { useMemo, useState } from "react";
import { ChallengeCard } from "@/components/ChallengeCard";
import { cx } from "@/lib/utils";
import {
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  DIFFICULTY_EMOJI,
  DIFFICULTY_LABELS,
  type Category,
  type Challenge,
  type Difficulty,
  type SubmissionStatus,
} from "@/lib/types";

type Sort = "points-desc" | "points-asc" | "recent";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "extreme"];
const CATS: Category[] = ["social", "sport", "creative", "school", "funny", "team"];

export function ChallengesBrowser({
  challenges,
  statusByChallenge,
  rejectedReasons,
}: {
  challenges: Challenge[];
  statusByChallenge: Record<string, SubmissionStatus>;
  rejectedReasons: Record<string, string | null>;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [sort, setSort] = useState<Sort>("points-desc");
  const [hideDone, setHideDone] = useState(false);

  const filtered = useMemo(() => {
    let list = challenges.filter(
      (c) =>
        (difficulty === "all" || c.difficulty === difficulty) &&
        (category === "all" || c.category === category)
    );
    if (hideDone) {
      list = list.filter(
        (c) => !statusByChallenge[c.id] || statusByChallenge[c.id] === "rejected"
      );
    }
    const sorted = [...list];
    if (sort === "points-desc") sorted.sort((a, b) => b.points - a.points);
    if (sort === "points-asc") sorted.sort((a, b) => a.points - b.points);
    if (sort === "recent")
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return sorted;
  }, [challenges, difficulty, category, sort, hideDone, statusByChallenge]);

  return (
    <div>
      {/* Filtres difficulté */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <FilterChip
          active={difficulty === "all"}
          onClick={() => setDifficulty("all")}
          label="Tous"
        />
        {DIFFS.map((d) => (
          <FilterChip
            key={d}
            active={difficulty === d}
            onClick={() => setDifficulty(d)}
            label={`${DIFFICULTY_EMOJI[d]} ${DIFFICULTY_LABELS[d]}`}
          />
        ))}
      </div>

      {/* Filtres catégorie */}
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        <FilterChip
          active={category === "all"}
          onClick={() => setCategory("all")}
          label="Toutes catégories"
        />
        {CATS.map((c) => (
          <FilterChip
            key={c}
            active={category === c}
            onClick={() => setCategory(c)}
            label={`${CATEGORY_EMOJI[c]} ${CATEGORY_LABELS[c]}`}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <select
          className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
        >
          <option value="points-desc">Points décroissants</option>
          <option value="points-asc">Points croissants</option>
          <option value="recent">Plus récents</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="h-4 w-4 accent-violet-500"
          />
          Masquer les défis faits
        </label>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        {filtered.length} défi{filtered.length > 1 ? "s" : ""}
      </p>

      <div className="mt-2 grid gap-3 md:grid-cols-2">
        {filtered.map((c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            href={`/challenges/${c.id}`}
            status={statusByChallenge[c.id] ?? null}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card mt-4 p-8 text-center text-sm text-zinc-400">
          Aucun défi ne correspond à ces filtres. 🤷
        </div>
      ) : null}

      {Object.keys(rejectedReasons).length > 0 && hideDone === false ? (
        <p className="mt-4 text-xs text-zinc-600">
          💡 Un défi refusé peut être retenté : une nouvelle vidéo peut être
          envoyée.
        </p>
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
        active
          ? "bg-violet-500 text-white"
          : "bg-white/5 text-zinc-400 hover:bg-white/10"
      )}
    >
      {label}
    </button>
  );
}
