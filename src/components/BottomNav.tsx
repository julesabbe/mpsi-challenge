"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { BackButton } from "@/components/BackButton";
import { cx } from "@/lib/utils";

function useTabs() {
  const { isMpsi2 } = useSupabaseCtx();
  return [
    { href: "/dashboard", label: "Accueil", icon: "🏠" },
    { href: "/leaderboard", label: "Classement", icon: "🏆" },
    { href: "/challenges", label: "Défis", icon: "🎯" },
    ...(isMpsi2
      ? [{ href: "/videos", label: "Vidéos", icon: "🎥" }]
      : [{ href: "/team", label: "Équipe", icon: "👥" }]),
    { href: "/profile", label: "Profil", icon: "👤" },
  ];
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { supabase } = useSupabaseCtx();
  const tabs = useTabs();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    // Déconnexion totale : retour à la page d'accueil publique.
    router.replace("/guest");
    router.refresh();
  }

  return (
    <>
      {/* Barre de navigation (desktop) */}
      <nav className="sticky top-0 z-30 hidden items-center gap-1 border-b border-white/10 bg-zinc-950/90 px-3 py-2 backdrop-blur-lg md:flex">
        <BackButton fallback="/dashboard" />
        <Link
          href="/dashboard"
          className="ml-2 mr-1 flex shrink-0 items-center gap-1.5"
        >
          <span className="text-xl" aria-hidden>
            🏁
          </span>
          <span className="hidden text-sm font-extrabold tracking-tight text-white lg:inline">
            MPSI <span className="text-violet-400">Challenge</span>
          </span>
        </Link>
        <div className="mx-2 h-6 w-px bg-white/10" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                isActive(tab.href)
                  ? "bg-violet-500/15 text-violet-300"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              )}
            >
              <span aria-hidden>{tab.icon}</span>
              {tab.label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-red-300/80 transition-colors hover:bg-red-500/10 hover:text-red-300"
        >
          <span aria-hidden>🚪</span>
          Quitter
        </button>
      </nav>

      {/* Barre de navigation (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 backdrop-blur-lg md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cx(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                  active
                    ? "text-violet-400"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-red-300/80 transition-colors hover:text-red-300"
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
