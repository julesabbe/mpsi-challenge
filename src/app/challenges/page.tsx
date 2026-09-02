import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyStudent, getMyTeam } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { ChallengesBrowser } from "./browser";
import type { Challenge, Submission } from "@/lib/types";

export const metadata = { title: "Défis — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const profile = await getMyProfile();
  const student = await getMyStudent();

  if (profile?.role === "admin" && !student) redirect("/admin");
  if (!student) redirect("/select-student");
  const team = await getMyTeam(student.id);
  if (!team) redirect("/create-team");

  const supabase = await createClient();
  const [chRes, subRes, unreadRes] = await Promise.all([
    supabase.from("challenges").select("*").eq("active", true).order("points", { ascending: false }),
    supabase.from("submissions").select("*").eq("team_id", team.id),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", student.id)
      .eq("read", false),
  ]);

  const challenges = (chRes.data ?? []) as Challenge[];
  const submissions = (subRes.data ?? []) as Submission[];

  const statusByChallenge = new Map<string, Submission["status"]>();
  const rejected = new Map<string, Submission>();
  const prio: Record<Submission["status"], number> = {
    pending: 3,
    approved: 2,
    rejected: 1,
  };
  for (const s of submissions) {
    if (s.status === "rejected") {
      rejected.set(s.challenge_id, s);
    }
    const current = statusByChallenge.get(s.challenge_id);
    if (!current || prio[s.status] > prio[current]) {
      statusByChallenge.set(s.challenge_id, s.status);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 md:max-w-3xl md:pt-8">
      <TopBar unread={unreadRes.count ?? 0} isAdmin={profile?.role === "admin"} />
      <BottomNav />
      <h1 className="hidden text-3xl font-black tracking-tight text-white md:mb-6 md:block">
        🎯 Défis
      </h1>

      <div className="mt-4 md:mt-0">
        {challenges.length === 0 ? (
          <EmptyState
            icon="👀"
            title="Les défis arrivent bientôt"
            hint="Le Super Admin prépare de nouveaux défis."
          />
        ) : (
          <ChallengesBrowser
            challenges={challenges}
            statusByChallenge={Object.fromEntries(statusByChallenge)}
            rejectedReasons={Object.fromEntries(
              [...rejected].map(([id, s]) => [id, s.rejection_reason])
            )}
          />
        )}
      </div>
    </div>
  );
}
