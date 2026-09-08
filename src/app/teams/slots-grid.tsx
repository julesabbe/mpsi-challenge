"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { cx } from "@/lib/utils";
import { TEAM_EMOJIS } from "@/lib/types";

export type Slot = {
  slot_number: number;
  team: { id: string; name: string; emoji: string } | null;
  members: { id: string; name: string }[];
};

export function SlotsGrid({
  slots,
  me,
  availableTeammates,
  myTeamId,
}: {
  slots: Slot[];
  me: { id: string; name: string };
  availableTeammates: { id: string; name: string }[];
  myTeamId: string | null;
}) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [m2, setM2] = useState<string | null>(null);
  const [m3, setM3] = useState<string | null>(null);
  const [m4, setM4] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⚡");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm(slot: number) {
    setOpenSlot(slot);
    setM2(null);
    setM3(null);
    setM4(null);
    setName("");
    setEmoji("⚡");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const isFour = openSlot === 15;
    if (isFour) {
      if (!m2 || !m3 || !m4) {
        setError("La case 15 demande 3 coéquipiers (en plus de toi, 4 membres).");
        return;
      }
    } else if (!m2 || !m3) {
      setError("Coche 2 coéquipiers (en plus de toi).");
      return;
    }
    if (name.trim().length < 2) {
      setError("Le nom de l'équipe est obligatoire (2 caractères minimum).");
      return;
    }
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("claim_team_slot", {
      p_slot: openSlot,
      p_team_name: name.trim(),
      p_emoji: emoji,
      p_member2: m2,
      p_member3: m3,
      p_member4: m4,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.replace("/dashboard?welcome=1");
    router.refresh();
  }

  function togglePick(id: string) {
    const isFour = openSlot === 15;
    if (m2 === id) setM2(null);
    else if (m3 === id) setM3(null);
    else if (m4 === id) setM4(null);
    else if (!m2) setM2(id);
    else if (!m3) setM3(id);
    else if (isFour && !m4) setM4(id);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {slots.map((slot) => {
        const taken = slot.team !== null;
        const isMine = taken && myTeamId === slot.team!.id;
        return (
          <div
            key={slot.slot_number}
            className={cx(
              "card p-4",
              isMine && "border-violet-500/50 bg-violet-500/10",
              !taken && "border-dashed"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Case {slot.slot_number}
              </p>
              {taken ? (
                <span
                  className={cx(
                    "rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                    isMine ? "bg-violet-500/25 text-violet-200" : "bg-white/10 text-zinc-400"
                  )}
                >
                  {isMine ? "Ton équipe" : "Prise"}
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-300">
                  Libre
                </span>
              )}
            </div>

            {taken ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-2xl" aria-hidden>{slot.team!.emoji}</span>
                  <p className="truncate font-black text-white">{slot.team!.name}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {slot.members.map((m) => (
                    <span key={m.id} className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-zinc-300">
                      {m.id === me.id ? "⭐ " : "👤 "}{m.name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <button
                type="button"
                disabled={myTeamId !== null}
                onClick={() => openForm(slot.slot_number)}
                className={cx(
                  "mt-3 w-full rounded-xl border border-dashed border-white/15 py-3 text-sm font-semibold transition",
                  myTeamId === null
                    ? "text-emerald-300 hover:border-emerald-400/40 hover:bg-emerald-500/5"
                    : "cursor-not-allowed text-zinc-600"
                )}
              >
                {myTeamId === null ? "+ Réserver cette case" : "Tu as déjà une équipe"}
              </button>
            )}
          </div>
        );
      })}

      {/* Formulaire de réservation */}
      {openSlot !== null ? (
        <form
          onSubmit={submit}
          className="card fixed inset-x-4 bottom-4 z-50 max-h-[80dvh] space-y-3 overflow-y-auto p-4 shadow-2xl sm:relative sm:inset-auto sm:bottom-auto sm:col-span-2"
        >
          <div className="flex items-center justify-between">
            <p className="font-black text-white">Case {openSlot} — Ton équipe</p>
            <button
              type="button"
              onClick={() => setOpenSlot(null)}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          </div>

          <div className="rounded-xl bg-violet-500/10 px-3 py-2 text-sm text-violet-200">
            ⭐ {me.name} <span className="text-violet-300/60">(toi)</span>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              {openSlot === 15
                ? "Coche 3 coéquipiers (case 15 : 4 membres)"
                : "Coche 2 coéquipiers"}
            </p>
            <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
              {availableTeammates.map((o) => {
                const picked =
                  m2 === o.id ? 2 : m3 === o.id ? 3 : m4 === o.id ? 4 : 0;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => togglePick(o.id)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                      picked
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-white/5 bg-white/[0.02] hover:border-white/20"
                    )}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                      {o.name.charAt(0)}
                    </span>
                    <span className="flex-1 text-sm font-medium text-white">{o.name}</span>
                    {picked ? (
                      <span className="text-xs font-bold text-violet-300">Membre {picked}</span>
                    ) : null}
                  </button>
                );
              })}
              {availableTeammates.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-500">
                  Plus aucun élève MPSI disponible 😬
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <label htmlFor="team-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Nom de l&apos;équipe
            </label>
            <input
              id="team-name"
              className="input-base"
              placeholder="Les Turbo, Team Centrale…"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Emoji
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

          {error ? (
            <p className="animate-pop rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Réservation…" : "RÉSERVER LA CASE"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
