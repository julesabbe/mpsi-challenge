"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { cx } from "@/lib/utils";
import { TEAM_EMOJIS } from "@/lib/types";

type Other = { id: string; name: string };

export function CreateTeamForm({
  me,
  others,
}: {
  me: { id: string; first_name: string; last_name: string | null };
  others: Other[];
}) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [m2, setM2] = useState<Other | null>(null);
  const [m3, setM3] = useState<Other | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⚡");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = useMemo(
    () => others.filter((o) => o.id !== m2?.id && o.id !== m3?.id),
    [others, m2, m3]
  );

  const canGoStep2 = m2 !== null && m3 !== null;
  const initials = `${me.first_name.charAt(0).toUpperCase()}${
    me.last_name ? me.last_name.charAt(0).toUpperCase() : ""
  }`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canGoStep2) {
      setError("Vous devez sélectionner deux autres membres.");
      setStep(1);
      return;
    }
    if (name.trim().length < 2) {
      setError("Le nom de l'équipe est obligatoire (2 caractères minimum).");
      return;
    }
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("create_team_rpc", {
      p_team_name: name.trim(),
      p_member2: m2!.id,
      p_member3: m3!.id,
      p_emoji: emoji,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.replace("/dashboard?welcome=1");
    router.refresh();
  }

  function MemberCard({ person, slot }: { person: Other | null; slot: string }) {
    return (
      <div className="card flex items-center gap-3 p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
          {person ? person.name.charAt(0).toUpperCase() : "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            {slot}
          </p>
          <p className="truncate text-sm font-semibold text-white">
            {person ? person.name : "À choisir"}
          </p>
        </div>
        {person ? (
          <button
            type="button"
            onClick={() => (slot === "MEMBRE 2" ? setM2(null) : setM3(null))}
            className="text-xs font-semibold text-zinc-500 hover:text-red-300"
          >
            Retirer
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-md px-5 pb-16 pt-10"
    >
      <div className="animate-rise">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
          Étape 2/2
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
          Forme ton équipe
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Ton équipe doit être composée de 3 personnes. Choisis bien tes
          coéquipiers, c&apos;est définitif !
        </p>
      </div>

      {/* TOI */}
      <div className="card mt-6 flex items-center gap-3 border-violet-500/40 bg-violet-500/10 p-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-bold text-white">
          {initials}
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-300">
            Toi
          </p>
          <p className="font-semibold text-white">
            {me.first_name} {me.last_name ?? ""}
          </p>
        </div>
      </div>

      {step === 1 ? (
        <div className="animate-rise mt-4 space-y-4">
          <MemberCard person={m2} slot="MEMBRE 2" />
          <MemberCard person={m3} slot="MEMBRE 3" />

          <div className="card p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              {m2 && m3 ? "Remplacer un membre" : "Sélectionne 2 élèves"}
            </p>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {remaining.map((o) => {
                const selectedAs = m2?.id === o.id ? 2 : m3?.id === o.id ? 3 : 0;
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={!m2 || !m3}
                    onClick={() => {
                      if (!m2) setM2(o);
                      else if (!m3) setM3(o);
                      else if (selectedAs === 2) setM2(null);
                      else if (selectedAs === 3) setM3(null);
                    }}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                      selectedAs
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-white/5 bg-white/[0.02] hover:border-white/20",
                      !m2 || !m3 ? "opacity-40" : "active:scale-[0.99]"
                    )}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                      {o.name.charAt(0)}
                    </span>
                    <span className="flex-1 text-sm font-medium text-white">
                      {o.name}
                    </span>
                    {selectedAs ? (
                      <span className="text-xs font-bold text-violet-300">
                        Membre {selectedAs}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {remaining.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-500">
                  Plus aucun élève disponible 😬
                </p>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Une fois les 2 membres choisis, tape sur un élève pour le
              remplacer.
            </p>
          </div>

          <button
            type="button"
            disabled={!canGoStep2}
            onClick={() => setStep(2)}
            className="btn-primary"
          >
            CONTINUER
          </button>
        </div>
      ) : (
        <div className="animate-rise mt-4 space-y-4">
          <div className="card p-4">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Nom de ton équipe
            </label>
            <input
              className="input-base"
              placeholder="Les Turbo, Team Centrale…"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="card p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Emoji de l&apos;équipe
            </p>
            <div className="grid grid-cols-8 gap-1.5">
              {TEAM_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cx(
                    "flex h-10 items-center justify-center rounded-xl text-xl transition",
                    emoji === e
                      ? "bg-violet-500/25 ring-2 ring-violet-500"
                      : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Création…" : "CRÉER MON ÉQUIPE"}
          </button>
          <button type="button" onClick={() => setStep(1)} className="btn-ghost w-full">
            ← Modifier les membres
          </button>
        </div>
      )}

      {error ? (
        <p className="animate-pop mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}
