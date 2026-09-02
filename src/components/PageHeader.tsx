import Link from "next/link";
import { cx } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  back,
  badge,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  badge?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex items-center gap-3">
      {back ? (
        <Link
          href={back}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10"
          aria-label="Retour"
        >
          ←
        </Link>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-extrabold tracking-tight text-white">
          {title}
        </h1>
        {subtitle ? (
          <p className="truncate text-sm text-zinc-400">{subtitle}</p>
        ) : null}
      </div>
      {badge ? <div className="shrink-0">{badge}</div> : null}
    </header>
  );
}

export function Badge({
  children,
  color = "zinc",
  className,
}: {
  children: React.ReactNode;
  color?: "zinc" | "green" | "yellow" | "red" | "violet" | "blue";
  className?: string;
}) {
  const colors: Record<string, string> = {
    zinc: "bg-white/10 text-zinc-300",
    green: "bg-emerald-500/15 text-emerald-300",
    yellow: "bg-amber-500/15 text-amber-300",
    red: "bg-red-500/15 text-red-300",
    violet: "bg-violet-500/15 text-violet-300",
    blue: "bg-sky-500/15 text-sky-300",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        colors[color],
        className
      )}
    >
      {children}
    </span>
  );
}
