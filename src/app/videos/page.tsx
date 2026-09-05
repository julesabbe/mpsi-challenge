import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyStudent } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { VideoGallery } from "./gallery";
import type { Submission } from "@/lib/types";

export const metadata = { title: "Vidéos — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const profile = await getMyProfile();
  const student = await getMyStudent();

  if (profile?.role === "admin" && !student) redirect("/admin");
  if (!student) redirect("/login-student");

  const supabase = await createClient();

  // Toutes les soumissions (métadonnées lisibles par tous les authentifiés).
  // L'accès RÉEL au fichier vidéo est filtré par la policy Storage :
  //  - MP/PSI : toutes les vidéos
  //  - MPSI   : uniquement celles de sa propre équipe
  const subsRes = await supabase
    .from("submissions")
    .select(
      "id, video_path, status, submitted_at, teams(name, emoji), challenges(title, points), students(first_name, last_name)"
    )
    .order("submitted_at", { ascending: false })
    .limit(100);

  const submissions = (subsRes.data ?? []) as unknown as Array<
    Pick<Submission, "id" | "video_path" | "status" | "submitted_at"> & {
      teams: { name: string; emoji: string } | null;
      challenges: { title: string; points: number } | null;
      students: { first_name: string; last_name: string | null } | null;
    }
  >;

  const unreadRes = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", student.id)
    .eq("read", false);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 md:max-w-3xl md:pt-8">
      <TopBar unread={unreadRes.count ?? 0} isAdmin={profile?.role === "admin"} />
      <BottomNav />

      <div className="mt-4 md:mt-0">
        <h1 className="text-2xl font-black tracking-tight text-white">
          🎥 Vidéos soumises
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {student.track === "mpsi2"
            ? "Toutes les preuves envoyées par les équipes MPSI."
            : "Les preuves de ton équipe. Les autres équipes ne sont pas accessibles."}
        </p>
      </div>

      <div className="mt-5">
        {submissions.length === 0 ? (
          <EmptyState
            icon="🎬"
            title="Aucune vidéo pour le moment"
            hint="Les preuves apparaîtront ici dès que les équipes soumettront leurs défis."
          />
        ) : (
          <VideoGallery
            submissions={submissions.map((s) => ({
              id: s.id,
              videoPath: s.video_path,
              status: s.status,
              teamName: s.teams?.name ?? "?",
              teamEmoji: s.teams?.emoji ?? "❓",
              challengeTitle: s.challenges?.title ?? "Défi",
              points: s.challenges?.points ?? 0,
              author: s.students
                ? s.students.last_name
                  ? `${s.students.first_name} ${s.students.last_name}`
                  : s.students.first_name
                : "?",
              date: s.submitted_at,
            }))}
          />
        )}
      </div>
    </div>
  );
}
