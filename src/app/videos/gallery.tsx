"use client";

import { useEffect, useState } from "react";
import { useSupabaseCtx } from "@/lib/supabase/provider";
import { Badge } from "@/components/PageHeader";
import { formatDate } from "@/lib/utils";
import { cx } from "@/lib/utils";

type Item = {
  id: string;
  videoPath: string;
  status: string;
  teamName: string;
  teamEmoji: string;
  challengeTitle: string;
  points: number;
  author: string;
  date: string;
};

const STATUS: Record<string, { emoji: string; label: string; color: "green" | "yellow" | "red" }> = {
  approved: { emoji: "🟢", label: "Validée", color: "green" },
  pending: { emoji: "🟡", label: "En attente", color: "yellow" },
  rejected: { emoji: "🔴", label: "Refusée", color: "red" },
};

export function VideoGallery({ submissions }: { submissions: Item[] }) {
  const { supabase } = useSupabaseCtx();
  const [urls, setUrls] = useState<Record<string, string | null>>({});

  // Signed URLs (1 h) — la policy Storage filtre : les vidéos non autorisées
  // renverront null et seront affichées comme "non accessible".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        submissions.map(async (s) => {
          const { data } = await supabase.storage
            .from("challenge-submissions")
            .createSignedUrl(s.videoPath, 3600);
          return [s.id, data?.signedUrl ?? null] as const;
        })
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [submissions, supabase]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {submissions.map((s) => {
        const url = urls[s.id];
        const meta = STATUS[s.status] ?? STATUS.pending;
        return (
          <div key={s.id} className="card overflow-hidden p-0">
            {url ? (
              <video src={url} controls preload="metadata" className="aspect-video w-full bg-black" />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-black/60">
                {url === null && urls[s.id] === null ? (
                  <p className="px-6 text-center text-sm text-zinc-500">
                    🔒 Vidéo non accessible depuis ton compte
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500">Chargement…</p>
                )}
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate font-bold text-white">
                  {s.teamEmoji} {s.challengeTitle}
                </p>
                <Badge color={meta.color}>
                  {meta.emoji} {meta.label}
                </Badge>
              </div>
              <p className={cx("mt-1 text-xs text-zinc-500")}>
                {s.teamName} · {s.author} · {formatDate(s.date)}
              </p>
              <p className="mt-1 text-xs font-bold text-violet-300">
                +{s.points} pts
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
