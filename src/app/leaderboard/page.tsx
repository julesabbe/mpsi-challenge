import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyStudent, getMyTeam, getTeamScores } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { LeaderboardList } from "@/components/LeaderboardList";

export const metadata = { title: "Classement — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const profile = await getMyProfile();
  const student = await getMyStudent();

  if (profile?.role === "admin" && !student) redirect("/admin");
  if (!student) redirect("/login-student");
  const team = await getMyTeam(student.id);

  const supabase = await createClient();
  const [scores, unreadRes] = await Promise.all([
    getTeamScores(),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", student.id)
      .eq("read", false),
  ]);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 md:max-w-2xl md:pt-8">
      <TopBar unread={unreadRes.count ?? 0} isAdmin={profile?.role === "admin"} />
      <BottomNav />
      <div className="mt-4 md:mt-0">
        <h1 className="text-2xl font-black tracking-tight text-white">
          🏆 Classement
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Les points sont calculés en temps réel à partir des défis validés.
        </p>
      </div>

      <div className="mt-5">
        {scores.length === 0 ? (
          <EmptyState
            icon="🏁"
            title="Les équipes commencent bientôt la compétition."
            hint="Crée ton équipe pour être le premier au classement !"
          />
        ) : (
          <LeaderboardList rows={scores} myTeamId={team?.id} />
        )}
      </div>
    </div>
  );
}
