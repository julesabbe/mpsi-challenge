"use client";

import { createContext, useContext } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Ctx = {
  supabase: SupabaseClient;
  unread: number;
  isAdmin: boolean;
};

const SupabaseContext = createContext<Ctx | null>(null);

export function useSupabaseCtx() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) throw new Error("useSupabaseCtx must be used within SupabaseProvider");
  return ctx;
}

export function SupabaseProvider({
  children,
  unread,
  isAdmin,
}: {
  children: React.ReactNode;
  unread: number;
  isAdmin: boolean;
}) {
  const supabase = createClient();
  return (
    <SupabaseContext.Provider value={{ supabase, unread, isAdmin }}>
      {children}
    </SupabaseContext.Provider>
  );
}
