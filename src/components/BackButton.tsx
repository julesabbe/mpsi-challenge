"use client";

import { useRouter } from "next/navigation";
import { cx } from "@/lib/utils";

/**
 * Bouton « Retour » réutilisable : revient à la page précédente de
 * l'historique du navigateur, ou tombe sur `fallback` quand il n'y a pas
 * d'historique (arrivée directe sur la page).
 */
export function BackButton({
  fallback = "/dashboard",
  label,
  className,
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.replace(fallback);
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={label ?? "Retour"}
      title={label ?? "Retour"}
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white",
        label ? "gap-1.5 px-3.5 py-2 text-sm font-semibold" : "h-9 w-9 text-lg",
        className
      )}
    >
      <span aria-hidden className="leading-none">
        ←
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}
