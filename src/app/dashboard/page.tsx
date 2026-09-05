import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyStudent, getMyTeam, getTeamScores } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { ProgressBar } from "@/components/EmptyState";
import { LeaderboardList } from "@/components/LeaderboardList";
import { ChallengeCard } from "@/components/ChallengeCard";
import { formatPoints, ordinalRank } from "@/lib/utils";
import type { Challenge, Submission, SubmissionStatus } from "@/lib/types";

export const metadata = { title: "Accueil — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const profile = await getMyProfile();
  const student = await getMyStudent();

  if (profile?.role === "admin" && !student) redirect("/admin");
  if (!student) redirect("/login-student");

  const team = await getMyTeam(student.id);
  if (!team && student.track === "mpsi") redirect("/teams");

  const supabase = await createClient();
  const [scores, subsRes, chRes, unreadRes] = await Promise.all([
    getTeamScores(),
    team
      ? supabase
          .from("submissions")
          .select("challenge_id, status, submitted_at")
          .eq("team_id", team.id)
      : Promise.resolve({ data: [] } as unknown as { data: Pick<Submission, "challenge_id" | "status" | "submitted_at">[] }),
    supabase
      .from("challenges")
      .select("*")
      .eq("active", true)
      .order("points", { ascending: false }),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", student.id)
      .eq("read", false),
  ]);

  const myRow = scores.find((r) => r.team.id === team.id);
  const challenges = (chRes.data ?? []) as unknown as Challenge[];
  const subs = (subsRes.data ?? []) as Pick<
    Submission,
    "challenge_id" | "status" | "submitted_at"
  >[];

  // Statut par défi pour mon équipe : pending > approved > rejected
  const statusByChallenge = new Map<string, SubmissionStatus>();
  for (const s of subs) {
    const current = statusByChallenge.get(s.challenge_id);
    const prio: Record<SubmissionStatus, number> = {
      pending: 3,
      approved: 2,
      rejected: 1,
    };
    if (!current || prio[s.status] > prio[current]) {
      statusByChallenge.set(s.challenge_id, s.status);
    }
  }

  const todoChallenges = challenges
    .filter((c) => !statusByChallenge.has(c.id))
    .slice(0, 4);

  const validated = myRow?.validatedCount ?? 0;
  const pending = myRow?.pendingCount ?? 0;
  const rank = myRow?.rank ?? scores.length;
  const points = myRow?.points ?? 0;

  // Badges
  const badges: Array<{ emoji: string; label: string }> = [];
  if (validated >= 1) badges.push({ emoji: "🔥", label: "Premier défi" });
  if (validated >= 5) badges.push({ emoji: "🎯", label: "5 défis validés" });
  if (points >= 1000) badges.push({ emoji: "💯", label: "1000 points" });
  if (points >= 2500) badges.push({ emoji: "🚀", label: "2500 points" });
  if (rank === 1) badges.push({ emoji: "👑", label: "Équipe n°1" });
  else if (rank <= 3) badges.push({ emoji: "🏆", label: "Podium" });

  const totalActive = challenges.length;
  const nextThreshold = Math.max(1000, Math.ceil((points + 1) / 500) * 500);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 md:max-w-3xl md:pt-8">
      <TopBar unread={unreadRes.count ?? 0} isAdmin={profile?.role === "admin"} />
      <BottomNav />

      <div className="hidden items-center justify-between md:mb-6 md:flex">
        <h1 className="text-3xl font-black tracking-tight text-white">
          MPSI <span className="text-violet-400">Challenge</span>
        </h1>
        <Link
          href="/notifications"
          className="text-sm font-semibold text-violet-300 hover:underline"
        >
          🔔 Notifications{" "}
          {(unreadRes.count ?? 0) > 0 ? `(${unreadRes.count})` : ""}
        </Link>
      </div>

      {welcome ? (
        <div className="animate-pop card mb-4 border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
          <p className="text-lg font-bold text-emerald-300">
            🎉 Équipe créée, que l&apos;aventure commence !
          </p>
          <p className="mt-1 text-sm text-emerald-200/70">
            Réalisez votre premier défi pour marquer vos premiers points.
          </p>
        </div>
      ) : null}

      {/* Mon équipe (uniquement si l'élève en a une) */}
      {!team ? (
        <section className="card animate-rise p-5 text-center">
          <span className="text-4xl" aria-hidden>⚙️</span>
          <p className="mt-2 font-black text-white">Compte MP/PSI</p>
          <p className="mt-1 text-sm text-zinc-400">
            Tu suis la compétition : classement, défis, équipes et vidéos. Les
            équipes MPSI s&apos;occupent du reste !
          </p>
        </section>
      ) : (
      <section className="card animate-rise overflow-hidden p-0">
        <div className="bg-gradient-to-r from-violet-600/25 to-fuchsia-500/15 px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-violet-300">
            Mon équipe
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-3xl" aria-hidden>
              {team.emoji}
            </span>
            <h2 className="truncate text-2xl font-black text-white">
              {team.name}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10 text-center">
          <div className="px-2 py-3">
            <p className="text-xl font-black text-violet-300">
              {formatPoints(points)}
            </p>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              Points
            </p>
          </div>
          <div className="px-2 py-3">
            <p className="text-xl font-black text-white">
              {ordinalRank(rank)}
              <span className="text-sm font-semibold text-zinc-500">
                /{scores.length}
              </span>
            </p>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              Classement
            </p>
          </div>
          <div className="px-2 py-3">
            <p className="text-xl font-black text-white">{validated}</p>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              Défis ✅
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex flex-wrap gap-1.5">
            {myRow?.members.map((m) => (
              <span
                key={m.id}
                className="rounded-full bg-white/5 px-3 py-1 text-sm text-zinc-300"
              >
                👤 {m.first_name}
              </span>
            ))}
          </div>

          {badges.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className="animate-pop rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300"
                >
                  {b.emoji} {b.label}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-zinc-500">
              <span>
                Progression : {validated}/{totalActive} défis
              </span>
              <span>Prochain palier : {formatPoints(nextThreshold)} pts</span>
            </div>
            <ProgressBar value={validated} max={Math.max(totalActive, 1)} />
          </div>

          {pending > 0 ? (
            <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              🟡 {pending} défi{pending > 1 ? "s" : ""} en attente de validation
            </p>
          ) : null}
        </div>
      </section>
      )}

      {/* Classement top 3 */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">🏆 Classement</h2>
          <Link
            href="/leaderboard"
            className="text-sm font-semibold text-violet-300 hover:underline"
          >
            Voir tout →
          </Link>
        </div>
        {scores.length === 0 ? (
          <EmptyState
            icon="🏁"
            title="Les équipes commencent bientôt la compétition."
          />
        ) : (
          <LeaderboardList
            rows={scores.slice(0, 3)}
            myTeamId={team?.id}
          />
        )}
      </section>

      {/* Défis à faire */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">
            {team ? "🎯 Défis à faire" : "🎯 Défis en cours"}
          </h2>
          <Link
            href="/challenges"
            className="text-sm font-semibold text-violet-300 hover:underline"
          >
            Tous les défis →
          </Link>
        </div>
        {todoChallenges.length === 0 ? (
          <EmptyState
            icon="👀"
            title="Les défis arrivent bientôt"
            hint="Reviens plus tard, le Super Admin prépare de nouveaux défis."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {todoChallenges.map((c) => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                href={`/challenges/${c.id}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
