import Link from "next/link";
import { cx, formatPoints, ordinalRank } from "@/lib/utils";
import type { TeamScore } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardList({
  rows,
  myTeamId,
}: {
  rows: TeamScore[];
  myTeamId?: string | null;
}) {
  return (
    <ol className="space-y-2.5">
      {rows.map((row, i) => {
        const rank = row.rank ?? i + 1;
        const isMe = myTeamId === row.team.id;
        const podium = rank <= 3;
        return (
          <li
            key={row.team.id}
            className={cx(
              "card animate-rise flex items-center gap-3 px-4 py-3.5",
              podium && "border-yellow-500/30 bg-yellow-500/[0.06]",
              isMe && "ring-2 ring-violet-500/70"
            )}
            style={{ animationDelay: `${Math.min(i * 40, 250)}ms` }}
          >
            <span
              className={cx(
                "flex h-9 w-9 shrink-0 items-center justify-center text-lg",
                podium ? "" : "rounded-full bg-white/5 text-sm font-bold text-zinc-400"
              )}
              aria-hidden
            >
              {podium ? MEDALS[rank - 1] : rank}
            </span>

            <span className="text-2xl" aria-hidden>
              {row.team.emoji}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-white">
                {row.team.name}
                {isMe ? (
                  <span className="ml-2 text-xs font-semibold text-violet-300">
                    (ton équipe)
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-zinc-500">
                {rank === 1
                  ? "👑 Leader"
                  : `${ordinalRank(rank)} · ${row.validatedCount} défi${row.validatedCount > 1 ? "s" : ""} validé${row.validatedCount > 1 ? "s" : ""}`}
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
          </li>
        );
      })}
    </ol>
  );
}

export function LeaderboardLink() {
  return (
    <Link
      href="/leaderboard"
      className="text-sm font-semibold text-violet-300 hover:underline"
    >
      Voir tout →
    </Link>
  );
}
