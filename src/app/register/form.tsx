"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { cx } from "@/lib/utils";

type Track = "mpsi" | "mpsi2";

export function RegisterForm() {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [track, setTrack] = useState<Track | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!track) {
      setError("Choisis ta filière.");
      return;
    }
    if (password.length < 4) {
      setError("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      // 1) Inscription côté base (crée l'élève + le compte technique)
      const { error: rpcError } = await supabase.rpc("student_signup", {
        p_track: track,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_password: password,
      });
      if (rpcError) throw rpcError;

      // 2) Connexion immédiate avec le même mot de passe (pas d'e-mail)
      const { data: emailData, error: emailError } = await supabase.rpc(
        "student_login",
        {
          p_track: track,
          p_first_name: firstName.trim(),
          p_last_name: lastName.trim(),
          p_password: password,
        }
      );
      if (emailError) throw emailError;

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailData as unknown as string,
        password,
      });
      if (signInError) throw signInError;

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
          Inscription
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
          Crée ton compte
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Pas d&apos;e-mail : juste ton nom et un mot de passe.
        </p>
      </div>

      <form onSubmit={submit} className="animate-rise mt-6 space-y-4">
        {/* Choix de la filière */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTrack("mpsi")}
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
            onClick={() => setTrack("mpsi2")}
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

        <div className="card space-y-3 p-4">
          <div>
            <label htmlFor="reg-first" className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Prénom
            </label>
            <input
              id="reg-first"
              className="input-base"
              placeholder="Ex. : Jules"
              value={firstName}
              maxLength={40}
              autoComplete="off"
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="reg-last" className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Nom de famille
            </label>
            <input
              id="reg-last"
              className="input-base"
              placeholder="Ex. : Abbe"
              value={lastName}
              maxLength={40}
              autoComplete="off"
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="reg-pass" className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Mot de passe
            </label>
            <input
              id="reg-pass"
              type="password"
              className="input-base"
              placeholder="4 caractères minimum"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="reg-pass2" className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Confirme ton mot de passe
            </label>
            <input
              id="reg-pass2"
              type="password"
              className="input-base"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Création du compte…" : "S'INSCRIRE"}
        </button>

        <Link href="/login-student" className="btn-ghost block w-full text-center">
          J&apos;ai déjà un compte → Se connecter
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
