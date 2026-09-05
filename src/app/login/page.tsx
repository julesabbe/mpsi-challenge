"use client";

import { useState } from "react";
import Link from "next/link";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { BackButton } from "@/components/BackButton";

export default function LoginPage() {
  const { supabase } = useSupabaseCtx();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError("Identifiants incorrects.");
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <BackButton
        fallback="/guest"
        label="Accueil"
        className="fixed left-4 top-4"
      />
      <div className="animate-rise w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-6xl" aria-hidden>
            🛡️
          </span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
            Espace{" "}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Admin
            </span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Réservé au Super Admin MPSI Challenge.
          </p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-3 p-6">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Adresse e-mail"
            className="input-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Mot de passe"
            className="input-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? (
            <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Connexion…" : "SE CONNECTER"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Élève ?{" "}
          <Link href="/" className="text-violet-300 hover:underline">
            Retour à l&apos;app
          </Link>
        </p>
      </div>
    </main>
  );
}
