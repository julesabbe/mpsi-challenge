"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { cx } from "@/lib/utils";

export type GodparentVoteItem = {
  teamId: string;
  name: string;
  emoji: string;
  videoPath: string;
  voted: boolean;
  chosenName: string | null;
  canVote: boolean;
};

export function GodparentVoteList({ teams }: { teams: GodparentVoteItem[] }) {
  const { supabase } = useSupabaseCtx();
  const router = useRouter();

  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // URLs signées (1 h)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        teams.map(async (t) => {
          const { data } = await supabase.storage
            .from("challenge-submissions")
            .createSignedUrl(t.videoPath, 3600);
          return [t.teamId, data?.signedUrl ?? null] as const;
        })
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [teams, supabase]);

  async function toggle(teamId: string, want: boolean) {
    setError(null);
    setBusy(teamId);
    const { error: rpcError } = await supabase.rpc("toggle_godparent_offer", {
      p_team_id: teamId,
      p_want: want,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error ? (
        <p className="animate-pop mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4">
        {teams.map((t) => {
          const url = urls[t.teamId];
          return (
            <div key={t.teamId} className="card overflow-hidden p-0">
              <div className="flex items-center justify-between gap-2 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-white">
                    {t.emoji} {t.name}
                  </p>
                  {t.chosenName ? (
                    <p className="text-xs text-emerald-300">
                      🕊️ Parrain déjà choisi : {t.chosenName}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Équipe sans parrain pour le moment
                    </p>
                  )}
                </div>
                {t.voted ? (
                  <span className="shrink-0 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-300">
                    ✓ Tu te proposes
                  </span>
                ) : null}
              </div>

              {url ? (
                <video
                  src={url}
                  controls
                  preload="metadata"
                  className="aspect-video w-full bg-black"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-black/60">
                  {url === null && urls[t.teamId] === null ? (
                    <p className="px-6 text-center text-sm text-zinc-500">
                      🔒 Vidéo non accessible
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-500">Chargement…</p>
                  )}
                </div>
              )}

              {t.canVote ? (
                <div className="px-5 py-4">
                  {!t.voted ? (
                    <button
                      type="button"
                      disabled={busy === t.teamId}
                      onClick={() => toggle(t.teamId, true)}
                      className="btn-primary w-full"
                    >
                      {busy === t.teamId
                        ? "Enregistrement…"
                        : "🕊️ JE VEUX ÊTRE LE PARRAIN"}
                    </button>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-violet-200">
                        Candidature envoyée — l&apos;équipe peut te choisir.
                      </p>
                      <button
                        type="button"
                        disabled={busy === t.teamId}
                        onClick={() => toggle(t.teamId, false)}
                        className="shrink-0 text-xs font-semibold text-zinc-500 hover:text-red-300"
                      >
                        Se retirer
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GodparentEmpty() {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center"
      )}
    >
      <span className="text-4xl" aria-hidden>
        🕊️
      </span>
      <p className="font-semibold text-white">
        Aucune équipe n&apos;a encore publié sa vidéo de présentation
      </p>
      <p className="text-sm text-zinc-400">
        Dès qu&apos;une équipe se présente, tu pourras voter ici.
      </p>
    </div>
  );
}
