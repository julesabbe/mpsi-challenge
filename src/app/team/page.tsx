import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyStudent, getMyTeam, getTeamScores } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState, ProgressBar } from "@/components/EmptyState";
import { TeamPresentation } from "@/components/TeamPresentation";
import { Badge } from "@/components/PageHeader";
import { formatDate, formatPoints, ordinalRank, studentName } from "@/lib/utils";
import type { Challenge, Submission } from "@/lib/types";

export const metadata = { title: "Mon équipe — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const profile = await getMyProfile();
  const student = await getMyStudent();

  if (profile?.role === "admin" && !student) redirect("/admin");
  if (!student) redirect("/login-student");
  const team = await getMyTeam(student.id);
  if (!team) redirect("/teams");

  const supabase = await createClient();
  const [scores, subRes, unreadRes] = await Promise.all([
    getTeamScores(),
    supabase
      .from("submissions")
      .select("*, challenges(id, title, points, difficulty, category)")
      .eq("team_id", team.id)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", student.id)
      .eq("read", false),
  ]);

  const myRow = scores.find((r) => r.team.id === team.id);
  const submissions = (subRes.data ?? []) as Submission[];
  const points = myRow?.points ?? 0;
  const rank = myRow?.rank ?? scores.length;
  const validated = myRow?.validatedCount ?? 0;
  const pending = myRow?.pendingCount ?? 0;
  const rejected = submissions.filter((s) => s.status === "rejected").length;

  const badges: Array<{ emoji: string; label: string }> = [];
  if (validated >= 1) badges.push({ emoji: "🔥", label: "Premier défi" });
  if (validated >= 5) badges.push({ emoji: "🎯", label: "5 défis validés" });
  if (points >= 1000) badges.push({ emoji: "💯", label: "1000 points" });
  if (points >= 2500) badges.push({ emoji: "🚀", label: "2500 points" });
  if (rank === 1) badges.push({ emoji: "👑", label: "Équipe n°1" });
  else if (rank <= 3) badges.push({ emoji: "🏆", label: "Podium" });

  const nextGoal = Math.max(500, Math.ceil((points + 1) / 500) * 500);

  const statusMeta: Record<
    Submission["status"],
    { emoji: string; label: string; color: "green" | "yellow" | "red" }
  > = {
    approved: { emoji: "🟢", label: "Validé", color: "green" },
    pending: { emoji: "🟡", label: "En attente", color: "yellow" },
    rejected: { emoji: "🔴", label: "Refusé", color: "red" },
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 md:max-w-2xl md:pt-8">
      <TopBar unread={unreadRes.count ?? 0} isAdmin={profile?.role === "admin"} />
      <BottomNav />

      <div className="animate-rise mt-4 md:mt-0">
        <div className="card overflow-hidden p-0">
          <div className="flex items-center gap-3 bg-gradient-to-r from-violet-600/25 to-fuchsia-500/15 px-5 py-5">
            <span className="text-4xl" aria-hidden>
              {team.emoji}
            </span>
            <div>
              <h1 className="text-2xl font-black text-white">{team.name}</h1>
              <p className="text-sm text-zinc-400">
                Créée le {formatDate(team.created_at)}
              </p>
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
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              Membres
            </p>
            {myRow?.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-2xl px-2 py-2"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-bold text-white">
                  {m.first_name.charAt(0)}
                  {m.last_name ? m.last_name.charAt(0) : ""}
                </span>
                <span className="font-semibold text-white">
                  {studentName(m)}
                </span>
                {m.id === student.id ? (
                  <span className="ml-auto text-xs font-semibold text-violet-300">
                    toi
                  </span>
                ) : null}
              </div>
            ))}

            {badges.length > 0 ? (
              <>
                <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                  Badges
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {badges.map((b) => (
                    <span
                      key={b.label}
                      className="animate-pop rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300"
                    >
                      {b.emoji} {b.label}
                    </span>
                  ))}
                </div>
              </>
            ) : null}

            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs text-zinc-500">
                <span>
                  {formatPoints(points)} / {formatPoints(nextGoal)} points
                </span>
                <span>prochain palier</span>
              </div>
              <ProgressBar value={points} max={nextGoal} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <TeamPresentation
          teamId={team.id}
          videoPath={team.presentation_video_path ?? null}
        />
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-extrabold text-white">
          📋 Historique des défis
        </h2>
        <div className="mb-3 flex gap-2 text-xs">
          <Badge color="green">🟢 {validated} validés</Badge>
          <Badge color="yellow">🟡 {pending} en attente</Badge>
          <Badge color="red">🔴 {rejected} refusés</Badge>
        </div>

        {submissions.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="Aucun défi tenté pour le moment"
            hint="Rendez-vous dans l'onglet Défis pour commencer !"
          />
        ) : (
          <div className="space-y-2">
            {submissions.map((s) => {
              const meta = statusMeta[s.status];
              const ch = s.challenges as Pick<
                Challenge,
                "title" | "points"
              > | null;
              return (
                <div
                  key={s.id}
                  className="card flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {ch?.title ?? "Défi"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDate(s.submitted_at)}
                      {s.status === "rejected" && s.rejection_reason
                        ? ` · ${s.rejection_reason}`
                        : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge color={meta.color}>
                      {meta.emoji} {meta.label}
                    </Badge>
                    <p className="mt-1 text-xs font-bold text-violet-300">
                      +{ch?.points ?? "?"} pts
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
