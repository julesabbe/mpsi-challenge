import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyStudent, getMyTeam, getTeamScores } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { SignOutButton } from "./sign-out";
import { formatDate, formatPoints, studentName } from "@/lib/utils";

export const metadata = { title: "Profil — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getMyProfile();
  const student = await getMyStudent();

  if (profile?.role === "admin" && !student) redirect("/admin");
  if (!student) redirect("/select-student");
  const team = await getMyTeam(student.id);
  if (!team) redirect("/create-team");

  const supabase = await createClient();
  const [scores, mySubs, unreadRes] = await Promise.all([
    getTeamScores(),
    supabase
      .from("submissions")
      .select("id, status")
      .eq("submitted_by", student.id),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", student.id)
      .eq("read", false),
  ]);

  const myRow = scores.find((r) => r.team.id === team.id);
  const subs = mySubs.data ?? [];
  const sentByMe = subs.length;
  const approvedByMe = subs.filter((s) => s.status === "approved").length;
  const points = myRow?.points ?? 0;

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 md:max-w-2xl md:pt-8">
      <TopBar unread={unreadRes.count ?? 0} isAdmin={profile?.role === "admin"} />
      <BottomNav />

      <div className="animate-rise mt-4 md:mt-0">
        <div className="card p-6 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-2xl font-black text-white">
            {student.first_name.charAt(0)}
            {student.last_name ? student.last_name.charAt(0) : ""}
          </span>
          <h1 className="mt-3 text-2xl font-black text-white">
            {studentName(student)}
          </h1>
          <p className="text-sm text-zinc-400">
            Membre de {team.emoji} {team.name}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Identité verrouillée · compte créé le {formatDate(student.created_at)}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="card px-2 py-4">
            <p className="text-xl font-black text-violet-300">
              {formatPoints(points)}
            </p>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              Points équipe
            </p>
          </div>
          <div className="card px-2 py-4">
            <p className="text-xl font-black text-white">{sentByMe}</p>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              Vidéos envoyées
            </p>
          </div>
          <div className="card px-2 py-4">
            <p className="text-xl font-black text-emerald-300">
              {approvedByMe}
            </p>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              Défis validés*
            </p>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-zinc-600">
          * défis validés pour lesquels la preuve a été envoyée par toi
        </p>

        <div className="mt-6 space-y-2">
          {profile?.role === "admin" ? (
            <a href="/admin" className="btn-ghost w-full">
              🛡️ Espace Super Admin
            </a>
          ) : null}
          <SignOutButton />
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Pour modifier ton identité, contacte le Super Admin.
        </p>
      </div>
    </div>
  );
}
