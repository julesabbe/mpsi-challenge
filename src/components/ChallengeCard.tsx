import Link from "next/link";
import { Badge } from "@/components/PageHeader";
import { cx, formatPoints } from "@/lib/utils";
import {
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  DIFFICULTY_EMOJI,
  DIFFICULTY_LABELS,
  type Challenge,
  type SubmissionStatus,
} from "@/lib/types";

const STATUS_META: Record<
  SubmissionStatus,
  { label: string; color: "green" | "yellow" | "red"; emoji: string }
> = {
  approved: { label: "Validé", color: "green", emoji: "🟢" },
  pending: { label: "En attente", color: "yellow", emoji: "🟡" },
  rejected: { label: "Refusé", color: "red", emoji: "🔴" },
};

export function ChallengeCard({
  challenge,
  status = null,
  href,
}: {
  challenge: Challenge;
  status?: SubmissionStatus | null;
  href: string;
}) {
  const s = status ? STATUS_META[status] : null;
  return (
    <Link
      href={href}
      className={cx(
        "card animate-rise block p-4 transition hover:border-violet-500/50 active:scale-[0.99]",
        status === "approved" && "opacity-75"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
          {CATEGORY_EMOJI[challenge.category]} {CATEGORY_LABELS[challenge.category]}
        </p>
        <span
          className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-2.5 py-1 text-xs font-black text-white"
          aria-label={`${challenge.points} points`}
        >
          +{formatPoints(challenge.points)}
        </span>
      </div>

      <h3 className="mt-2 font-bold leading-snug text-white">
        {challenge.title}
      </h3>
      {challenge.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
          {challenge.description}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <Badge color="zinc">
          {DIFFICULTY_EMOJI[challenge.difficulty]} {DIFFICULTY_LABELS[challenge.difficulty]}
        </Badge>
        {s ? (
          <Badge color={s.color}>
            {s.emoji} {s.label}
          </Badge>
        ) : (
          <Badge color="blue">🔒 À faire</Badge>
        )}
      </div>
    </Link>
  );
}
