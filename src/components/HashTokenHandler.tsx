"use client";

import { useEffect } from "react";
import { useSupabaseCtx } from "@/lib/supabase/provider";

/**
 * Consomme les jetons implicites (#access_token=...) présents dans l'URL
 * lorsque qu'un lien magique est généré en dehors de supabase-js (ex : e-mail
 * de confirmation envoyé par l'API). Transforme le hash en session cookie puis
 * redirige vers le dashboard.
 */
export function HashTokenHandler() {
  const { supabase } = useSupabaseCtx();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          window.location.replace("/login");
          return;
        }
        window.location.replace("/dashboard");
      });
  }, [supabase]);

  return null;
}
