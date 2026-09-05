"use client";

import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";

export function SignOutButton() {
  const { supabase, isAdmin } = useSupabaseCtx();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    // La déconnexion est totale : aucune session ne reste liée à l'appareil.
    router.replace("/guest");
    router.refresh();
  }

  return (
    <button type="button" className="btn-ghost w-full text-red-300" onClick={handleSignOut}>
      {isAdmin ? "Se déconnecter (admin)" : "Se déconnecter"}
    </button>
  );
}
