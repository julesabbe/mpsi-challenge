"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { cx, studentName } from "@/lib/utils";
import type { Student } from "@/lib/types";

const TRACKS: Array<{ id: "mpsi" | "mpsi2"; label: string; icon: string }> = [
  { id: "mpsi", label: "MPSI", icon: "📐" },
  { id: "mpsi2", label: "MP / PSI", icon: "⚙️" },
];

export function IdentityPanel({
  students,
  isAdmin,
  activeTrack,
}: {
  students: Student[];
  isAdmin: boolean;
  activeTrack?: string | null;
}) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [track, setTrack] = useState<"mpsi" | "mpsi2">(
    TRACKS.find((t) => !students.some((s) => s.track === t.id))?.id ?? "mpsi"
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBothTracks =
    students.some((s) => s.track === "mpsi") &&
    students.some((s) => s.track === "mpsi2");

  function pickTrack(id: "mpsi" | "mpsi2") {
    setTrack(id);
    setError(null);
  }

  async function switchTrack(id: "mpsi" | "mpsi2") {
    document.cookie = `mc_track=${id};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  async function linkStudent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 4) {
      setError("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("link_current_student", {
      p_track: track,
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_password: password,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setFirstName("");
    setLastName("");
    setPassword("");
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h2 className="font-extrabold text-white">🔄 Identités du compte</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Un seul compte peut être Super Admin, MPSI et/ou MP/PSI. Choisis
        l&apos;identité à utiliser dans l&apos;app.
      </p>

      <div className="mt-3 space-y-2">
        {isAdmin ? (
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-white/20"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg">
              🛡️
            </span>
            <span className="flex-1 text-sm font-semibold text-white">
              Super Admin
            </span>
            <span className="text-xs font-semibold text-zinc-400">
              espace dédié →
            </span>
          </Link>
        ) : null}

        {students.map((s) => {
          const active = s.track === activeTrack;
          return (
            <button
              key={s.id}
              type="button"
              disabled={active}
              onClick={() => switchTrack(s.track)}
              className={cx(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                active
                  ? "border-violet-500/50 bg-violet-500/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20"
              )}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg">
                {TRACKS.find((t) => t.id === s.track)?.icon}
              </span>
              <span className="flex-1 text-sm font-semibold text-white">
                {studentName(s)}
              </span>
              <span className="text-xs font-semibold text-zinc-400">
                {TRACKS.find((t) => t.id === s.track)?.label}
              </span>
              {active ? (
                <span className="text-xs font-bold text-violet-300">
                  ✓ actif
                </span>
              ) : (
                <span className="text-xs text-zinc-500">utiliser →</span>
              )}
            </button>
          );
        })}

        {students.length === 0 && !isAdmin ? (
          <p className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-zinc-500">
            Aucune identité élève liée à ce compte.
          </p>
        ) : null}
      </div>

      {!hasBothTracks ? (
        showForm ? (
          <form onSubmit={linkStudent} className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <div className="grid grid-cols-2 gap-2">
              {TRACKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTrack(t.id)}
                  className={cx(
                    "rounded-xl px-3 py-2 text-sm font-semibold transition",
                    track === t.id
                      ? t.id === "mpsi"
                        ? "bg-violet-500/90 text-white"
                        : "bg-cyan-500/90 text-white"
                      : "bg-white/5 text-zinc-400"
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input-base"
                placeholder="Prénom"
                value={firstName}
                maxLength={40}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className="input-base"
                placeholder="Nom de famille"
                value={lastName}
                maxLength={40}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <input
              type="password"
              className="input-base"
              placeholder="Ton mot de passe de connexion"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? (
              <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="btn-primary flex-1">
                {busy ? "Ajout…" : "AJOUTER CE PROFIL"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-2xl bg-white/5 px-4 text-sm font-semibold text-zinc-400"
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 block w-full rounded-2xl bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10"
          >
            + Lier un profil {students.length === 0 ? "élève" : "dans l'autre filière"}
          </button>
        )
      ) : null}
    </div>
  );
}
