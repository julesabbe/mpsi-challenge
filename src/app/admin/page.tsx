import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTeamScores } from "@/lib/queries";
import { formatPoints, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const [studentsRes, teamsRes, challengesRes, subsRes, txRes, scores] =
    await Promise.all([
      supabase.from("students").select("id, active, track"),
      supabase.from("teams").select("id"),
      supabase.from("challenges").select("id, active"),
      supabase
        .from("submissions")
        .select("id, status, submitted_at, teams(name), challenges(title, points), students(first_name)")
        .order("submitted_at", { ascending: false })
        .limit(8),
      supabase.from("point_transactions").select("amount, type"),
      getTeamScores(),
    ]);

  const students = (studentsRes.data ?? []) as Array<{
    id: string;
    active: boolean;
    track: string;
  }>;
  // Seuls les élèves MPSI participent : les comptes MP/PSI (spectateurs)
  // ne comptent pas dans les statistiques élèves.
  const mpsiStudents = students.filter((s) => s.track === "mpsi");
  const challenges = challengesRes.data ?? [];
  const tx = txRes.data ?? [];

  const { count: pendingTotal } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const pointsDistributed = tx
    .filter((t: { amount: number }) => t.amount > 0)
    .reduce((acc: number, t: { amount: number }) => acc + t.amount, 0);

  const stats = [
    { label: "Élèves MPSI", value: String(mpsiStudents.length), icon: "👥", href: "/admin/students", sub: `${mpsiStudents.filter((s) => s.active).length} actifs` },
    { label: "Équipes", value: String(teamsRes.data?.length ?? 0), icon: "🏆", href: "/admin/teams" },
    { label: "Défis", value: String(challenges.length), icon: "🎯", href: "/admin/challenges", sub: `${challenges.filter((c: { active: boolean }) => c.active).length} actifs` },
    { label: "Vidéos en attente", value: String(pendingTotal ?? 0), icon: "🎥", href: "/admin/submissions" },
    { label: "Points distribués", value: formatPoints(pointsDistributed), icon: "💰", href: "/admin/points" },
  ];

  const recentSubs = (subsRes.data ?? []) as unknown as Array<{
    id: string;
    status: string;
    submitted_at: string;
    teams: { name: string } | null;
    challenges: { title: string; points: number } | null;
    students: { first_name: string } | null;
  }>;

  const statusEmoji: Record<string, string> = {
    pending: "🟡",
    approved: "🟢",
    rejected: "🔴",
  };

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-white">
        📊 Dashboard
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        Vue d&apos;ensemble de la compétition.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card p-4 transition hover:border-violet-500/40"
          >
            <span className="text-2xl" aria-hidden>
              {s.icon}
            </span>
            <p className="mt-1 text-2xl font-black text-white">{s.value}</p>
            <p className="text-xs font-semibold text-zinc-400">{s.label}</p>
            {s.sub ? <p className="text-[11px] text-zinc-600">{s.sub}</p> : null}
          </Link>
        ))}
      </div>

      {pendingTotal && pendingTotal > 0 ? (
        <Link
          href="/admin/submissions"
          className="card mt-4 flex items-center gap-3 border-amber-500/40 bg-amber-500/10 p-4 transition hover:bg-amber-500/15"
        >
          <span className="text-2xl" aria-hidden>
            🎥
          </span>
          <div className="flex-1">
            <p className="font-bold text-amber-300">
              {pendingTotal} vidéo{pendingTotal > 1 ? "s" : ""} à valider
            </p>
            <p className="text-sm text-amber-200/70">
              Les équipes attendent leurs points !
            </p>
          </div>
          <span className="text-amber-300">→</span>
        </Link>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="mb-3 font-extrabold text-white">Dernières soumissions</h2>
          {recentSubs.length === 0 ? (
            <div className="card p-5 text-sm text-zinc-500">
              Aucune soumission en attente.
            </div>
          ) : (
            <div className="space-y-2">
              {recentSubs.map((s) => (
                <div key={s.id} className="card flex items-center gap-3 px-4 py-3">
                  <span aria-hidden>{statusEmoji[s.status] ?? "•"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {s.teams?.name ?? "?"} · {s.challenges?.title ?? "?"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {s.students?.first_name ?? "?"} · {timeAgo(s.submitted_at)}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-violet-300">
                    +{s.challenges?.points ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-extrabold text-white">Top équipes</h2>
          <div className="space-y-2">
            {scores.slice(0, 5).map((row) => (
              <div key={row.team.id} className="card flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-center text-sm font-bold text-zinc-500">
                  {row.rank}
                </span>
                <span aria-hidden>{row.team.emoji}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                  {row.team.name}
                </p>
                <span className="text-sm font-black text-violet-300">
                  {formatPoints(row.points)}
                </span>
              </div>
            ))}
            {scores.length === 0 ? (
              <div className="card p-5 text-sm text-zinc-500">
                Aucune équipe pour le moment.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
