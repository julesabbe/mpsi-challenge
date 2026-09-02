"use client";

import { usePathname } from "next/navigation";

/**
 * Cloche affichée dans le header utilisateur (desktop et mobile).
 * Le badge affiche le nombre de notifications non lues (récupéré côté serveur
 * et transmis via la variable CSS `--unread`).
 */
export function BellLink({
  unread = 0,
  className = "",
}: {
  unread?: number;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <a
      href={`/notifications?from=${encodeURIComponent(pathname)}`}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg transition hover:bg-white/10 ${className}`}
      aria-label="Notifications"
      style={{ ["--unread" as string]: String(unread) }}
    >
      🔔
      <span
        data-count={unread > 0 ? String(unread) : ""}
        className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white"
      >
        {unread > 0 ? (unread > 9 ? "9+" : unread) : ""}
      </span>
    </a>
  );
}
