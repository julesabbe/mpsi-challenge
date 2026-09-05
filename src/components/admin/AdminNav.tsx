"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { cx } from "@/lib/utils";

const ADMIN_TABS = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/students", label: "Élèves", icon: "👥" },
  { href: "/admin/teams", label: "Équipes", icon: "🏆" },
  { href: "/admin/challenges", label: "Défis", icon: "🎯" },
  { href: "/admin/submissions", label: "Vidéos", icon: "🎥" },
  { href: "/admin/points", label: "Points", icon: "💰" },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminNav() {
  const isActive = useIsActive();
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    // Retour à la page d'accueil publique (aucune session résiduelle)
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/10 bg-zinc-950/80 p-4 md:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2 px-2">
          <span className="text-2xl" aria-hidden>
            🏁
          </span>
          <span className="text-lg font-extrabold tracking-tight text-white">
            MPSI <span className="text-violet-400">Admin</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {ADMIN_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(tab.href)
                  ? "bg-violet-500/15 text-violet-300"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              )}
            >
              <span aria-hidden>{tab.icon}</span>
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1">
          <Link
            href="/dashboard"
            className="block rounded-xl px-3 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            ← Vue étudiant
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-300 transition hover:bg-red-500/10"
          >
            🚪 Se déconnecter
          </button>
        </div>
      </aside>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 backdrop-blur-lg md:hidden">
        <div className="grid grid-cols-7">
          {ADMIN_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(
                "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium",
                isActive(tab.href)
                  ? "text-violet-400"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <span className="text-lg leading-none" aria-hidden>
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-red-300/80 hover:text-red-300"
          >
            <span className="text-lg leading-none" aria-hidden>
              🚪
            </span>
            Quitter
          </button>
        </div>
      </nav>
    </>
  );
}
