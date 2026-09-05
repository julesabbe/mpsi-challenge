import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyStudent, getMyTeam } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { SubmitPanel } from "./submit-panel";
import {
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  DIFFICULTY_EMOJI,
  DIFFICULTY_LABELS,
  type Challenge,
  type Submission,
} from "@/lib/types";
import { formatPoints, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getMyProfile();
  const student = await getMyStudent();

  if (profile?.role === "admin" && !student) redirect("/admin");
  if (!student) redirect("/login-student");
  const team = await getMyTeam(student.id);
  const isMpsi = student.track === "mpsi";

  const supabase = await createClient();
  const [chRes, subRes, unreadRes] = await Promise.all([
    supabase.from("challenges").select("*").eq("id", id).maybeSingle(),
    team
      ? supabase
          .from("submissions")
          .select("*")
          .eq("team_id", team.id)
          .eq("challenge_id", id)
          .order("submitted_at", { ascending: false })
      : Promise.resolve({ data: [] } as unknown as { data: Submission[] }),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", student.id)
      .eq("read", false),
  ]);

  const challenge = chRes.data as Challenge | null;
  if (!challenge || !challenge.active) notFound();

  const submissions = (subRes.data ?? []) as Submission[];
  const pending = submissions.find((s) => s.status === "pending");
  const approved = submissions.find((s) => s.status === "approved");
  const lastRejected = submissions.find((s) => s.status === "rejected");

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 md:max-w-2xl md:pt-8">
      <TopBar unread={unreadRes.count ?? 0} isAdmin={profile?.role === "admin"} />
      <BottomNav />

      <div className="animate-rise mt-4 md:mt-0">
        <Link
          href="/challenges"
          className="text-sm font-semibold text-zinc-400 hover:text-zinc-200"
        >
          ← Tous les défis
        </Link>

        <div className="card mt-3 overflow-hidden p-0">
          <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-violet-600/25 to-fuchsia-500/15 px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-violet-300">
                {CATEGORY_EMOJI[challenge.category]}{" "}
                {CATEGORY_LABELS[challenge.category]} ·{" "}
                {DIFFICULTY_EMOJI[challenge.difficulty]}{" "}
                {DIFFICULTY_LABELS[challenge.difficulty]}
              </p>
              <h1 className="mt-1 text-xl font-black leading-tight text-white">
                {challenge.title}
              </h1>
            </div>
            <span className="shrink-0 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-2 text-lg font-black text-white">
              +{formatPoints(challenge.points)}
            </span>
          </div>

          <div className="px-5 py-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">
              {challenge.description || "Aucune description fournie."}
            </p>
            <div className="mt-3 flex gap-2">
              <Badge color="violet">
                {challenge.video_required
                  ? "🎥 Vidéo obligatoire"
                  : "✅ Pas de vidéo requise"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        {!team ? (
          isMpsi ? (
            <div className="card p-5 text-center">
              <p className="text-sm text-zinc-400">
                🤝 Tu n&apos;as pas encore d&apos;équipe — rejoins-en une pour
                pouvoir soumettre une preuve.
              </p>
              <Link href="/teams" className="btn-primary mt-4 w-full">
                REJOINDRE UNE ÉQUIPE
              </Link>
            </div>
          ) : (
            <div className="card p-5 text-center">
              <p className="text-sm text-zinc-400">
                👀 Tu suis les défis en MP/PSI — les équipes MPSI s&apos;en
                chargent ! Aucune soumission possible depuis ton compte.
              </p>
            </div>
          )
        ) : approved ? (
          <div className="card animate-pop border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
            <span className="text-4xl" aria-hidden>
              🟢
            </span>
            <p className="mt-2 text-lg font-bold text-emerald-300">
              Défi validé !
            </p>
            <p className="mt-1 text-sm text-emerald-200/70">
              +{formatPoints(challenge.points)} points crédités à {team.name}.
            </p>
          </div>
        ) : pending ? (
          <div className="card animate-pop border-amber-500/40 bg-amber-500/10 p-5 text-center">
            <span className="text-4xl" aria-hidden>
              🟡
            </span>
            <p className="mt-2 text-lg font-bold text-amber-300">
              En attente de validation
            </p>
            <p className="mt-1 text-sm text-amber-200/70">
              Preuve envoyée {timeAgo(pending.submitted_at)}. Le Super Admin va
              la visionner — patience !
            </p>
          </div>
        ) : (
          <SubmitPanel
            challengeId={challenge.id}
            teamId={team!.id}
            studentId={student.id}
            videoRequired={challenge.video_required}
            points={challenge.points}
            lastRejection={
              lastRejected
                ? {
                    reason: lastRejected.rejection_reason,
                    date: lastRejected.submitted_at,
                  }
                : null
            }
          />
        )}
      </div>
    </div>
  );
}
