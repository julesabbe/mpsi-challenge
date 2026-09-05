"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { cx } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const { isMpsi2 } = useSupabaseCtx();

  const tabs = [
    { href: "/dashboard", label: "Accueil", icon: "🏠" },
    { href: "/leaderboard", label: "Classement", icon: "🏆" },
    { href: "/challenges", label: "Défis", icon: "🎯" },
    ...(isMpsi2
      ? [{ href: "/videos", label: "Vidéos", icon: "🎥" }]
      : [{ href: "/team", label: "Équipe", icon: "👥" }]),
    { href: "/profile", label: "Profil", icon: "👤" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 backdrop-blur-lg md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(
                "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-violet-400" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <span className="text-lg leading-none" aria-hidden>
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
