"use client";

import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";

export function SignOutButton() {
  const { supabase, isAdmin } = useSupabaseCtx();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    // Le retour à la racine renverra : invité (élève/visiteur) ou /login
    // (admin), et l'élève pourra se redésigner sur ce même appareil.
    router.replace("/");
    router.refresh();
  }

  return (
    <button type="button" className="btn-ghost w-full text-red-300" onClick={handleSignOut}>
      {isAdmin ? "Se déconnecter" : "Changer d'identité sur cet appareil"}
    </button>
  );
}
