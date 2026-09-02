import Link from "next/link";
import { BellLink } from "@/components/BellLink";

export function TopBar({
  unread = 0,
  isAdmin = false,
}: {
  unread?: number;
  isAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-zinc-950/80 px-4 py-3 backdrop-blur-lg md:hidden">
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          🏁
        </span>
        <span className="text-base font-extrabold tracking-tight text-white">
          MPSI <span className="text-violet-400">Challenge</span>
        </span>
      </Link>
      <div className="flex items-center gap-2">
        {isAdmin ? (
          <Link
            href="/admin"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg transition hover:bg-white/10"
            aria-label="Espace admin"
          >
            🛡️
          </Link>
        ) : null}
        <BellLink unread={unread} />
      </div>
    </header>
  );
}
