import { cx } from "@/lib/utils";

export function EmptyState({
  icon = "👀",
  title,
  hint,
  className,
}: {
  icon?: string;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center",
        className
      )}
    >
      <span className="text-4xl" aria-hidden>
        {icon}
      </span>
      <p className="font-semibold text-white">{title}</p>
      {hint ? <p className="text-sm text-zinc-400">{hint}</p> : null}
    </div>
  );
}

export function Loader({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center justify-center py-10", className)}>
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-500" />
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  className,
  color = "violet",
}: {
  value: number;
  max: number;
  className?: string;
  color?: "violet" | "emerald" | "amber";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const colors: Record<string, string> = {
    violet: "from-violet-500 to-fuchsia-500",
    emerald: "from-emerald-400 to-teal-400",
    amber: "from-amber-400 to-orange-500",
  };
  return (
    <div
      className={cx(
        "h-2.5 w-full overflow-hidden rounded-full bg-white/10",
        className
      )}
    >
      <div
        className={cx(
          "h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out",
          colors[color]
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
