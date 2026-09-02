"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { studentName } from "@/lib/utils";
import type { Student } from "@/lib/types";

export function SelectStudentForm({ available }: { available: Student[] }) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((s) => studentName(s).toLowerCase().includes(q));
  }, [available, query]);

  async function choose(id: string) {
    setError(null);
    setBusyId(id);
    try {
      // 1) Session anonyme persistante pour cet appareil (si pas déjà présente)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) throw anonError;
      }

      // 2) Liaison élève ↔ appareil (définitive)
      const { error: rpcError } = await supabase.rpc("select_student_anon", {
        p_student_id: id,
      });
      if (rpcError) throw rpcError;

      router.replace("/create-team");
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "Une erreur est survenue.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-14">
      <div className="animate-rise">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
          Étape 1/2
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
          Qui es-tu ?
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sélectionne ton prénom. Ton identité restera sur cet appareil — plus
          besoin de compte ni de mot de passe.
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-5 bg-zinc-950/90 px-5 py-3 backdrop-blur">
        <input
          className="input-base"
          placeholder="Rechercher ton prénom…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error ? (
        <p className="animate-pop mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {filtered.map((s, i) => (
          <button
            key={s.id}
            onClick={() => choose(s.id)}
            disabled={busyId !== null}
            className="animate-rise card flex items-center gap-3 px-4 py-3.5 text-left transition hover:border-violet-500/50 hover:bg-zinc-900 active:scale-[0.99] disabled:opacity-50"
            style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-base font-bold text-white">
              {s.first_name.charAt(0).toUpperCase()}
              {s.last_name ? s.last_name.charAt(0).toUpperCase() : ""}
            </span>
            <span className="flex-1 font-semibold text-white">
              {studentName(s)}
            </span>
            <span className="text-zinc-500">→</span>
          </button>
        ))}
      </div>

      {available.length > 0 && filtered.length === 0 ? (
        <p className="mt-6 text-center text-sm text-zinc-500">
          Aucun élève ne correspond à « {query} ».
        </p>
      ) : null}

      {available.length === 0 ? (
        <div className="card mt-6 p-6 text-center text-sm text-zinc-400">
          Tous les élèves ont déjà choisi leur identité sur cet appareil ou font
          déjà partie d&apos;une équipe. 📋
        </div>
      ) : null}

      <Link href="/guest" className="mt-8 text-center text-sm text-zinc-500 hover:text-zinc-300">
        Continuer en mode invité →
      </Link>
    </main>
  );
}
