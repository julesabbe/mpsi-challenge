"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { cx } from "@/lib/utils";

type Track = "mpsi" | "mpsi2";

type StudentItem = {
  id: string;
  first_name: string;
  last_name: string | null;
  track: Track;
};

export function LoginStudentForm({ students }: { students: StudentItem[] }) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [track, setTrack] = useState<Track>("mpsi");
  const [selected, setSelected] = useState<StudentItem | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(
    () => students.filter((s) => s.track === track),
    [students, track]
  );

  function pickTrack(t: Track) {
    setTrack(t);
    setSelected(null);
    setPassword("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selected) {
      setError("Choisis ton nom dans la liste.");
      return;
    }
    setBusy(true);
    try {
      // 1) Retrouver l'e-mail technique correspondant au compte choisi
      const { data: emailData, error: emailError } = await supabase.rpc(
        "student_login",
        {
          p_track: selected.track,
          p_first_name: selected.first_name,
          p_last_name: selected.last_name ?? "",
          p_password: password,
        }
      );
      if (emailError) throw emailError;
      const technicalEmail = emailData as unknown as string | null;
      if (!technicalEmail) {
        setError("Mot de passe incorrect.");
        return;
      }

      // 2) Connexion Supabase classique
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: technicalEmail,
        password,
      });
      if (signInError) {
        setError("Mot de passe incorrect.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-14">
      <div className="animate-rise">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
          Connexion
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
          Qui es-tu ?
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sélectionne ton nom dans la liste, puis entre ton mot de passe.
        </p>
      </div>

      <form onSubmit={submit} className="animate-rise mt-6 space-y-4">
        {/* Filière */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => pickTrack("mpsi")}
            className={cx(
              "card p-4 text-center transition",
              track === "mpsi"
                ? "border-violet-500/60 bg-violet-500/10 ring-2 ring-violet-500"
                : "hover:border-white/20"
            )}
          >
            <span className="text-3xl" aria-hidden>📐</span>
            <p className="mt-1 font-black text-white">MPSI</p>
          </button>
          <button
            type="button"
            onClick={() => pickTrack("mpsi2")}
            className={cx(
              "card p-4 text-center transition",
              track === "mpsi2"
                ? "border-cyan-500/60 bg-cyan-500/10 ring-2 ring-cyan-500"
                : "hover:border-white/20"
            )}
          >
            <span className="text-3xl" aria-hidden>⚙️</span>
            <p className="mt-1 font-black text-white">MP / PSI</p>
          </button>
        </div>

        {/* Liste des élèves inscrits */}
        <div className="card p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            {track === "mpsi" ? "Élèves MPSI" : "Élèves MP / PSI"}
          </p>
          {list.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500">
              Aucun élève inscrit en{" "}
              {track === "mpsi" ? "MPSI" : "MP / PSI"} pour le moment.
            </p>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {list.map((s) => {
                const picked = selected?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelected(s);
                      setPassword("");
                      setError(null);
                    }}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                      picked
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-white/5 bg-white/[0.02] hover:border-white/20"
                    )}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                      {s.first_name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 text-sm font-medium text-white">
                      {s.first_name} {s.last_name ?? ""}
                    </span>
                    {picked ? (
                      <span className="text-xs font-bold text-violet-300">✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Mot de passe — visible quand un élève est sélectionné */}
        {selected ? (
          <div className="card space-y-3 p-4">
            <div>
              <p className="text-sm font-bold text-white">
                {selected.first_name} {selected.last_name ?? ""}
              </p>
              <p className="text-xs text-zinc-500">Entre ton mot de passe.</p>
            </div>
            <input
              id="log-pass"
              type="password"
              className="input-base"
              placeholder="Mot de passe"
              value={password}
              autoComplete="current-password"
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy || !selected}
          className="btn-primary"
        >
          {busy ? "Connexion…" : "SE CONNECTER"}
        </button>

        <Link href="/register" className="btn-ghost block w-full text-center">
          Pas encore de compte → S&apos;inscrire
        </Link>
        <Link href="/guest" className="block text-center text-sm text-zinc-500 hover:text-zinc-300">
          Continuer en mode invité
        </Link>

        {error ? (
          <p className="animate-pop rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}
      </form>
    </main>
  );
}