import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyStudent } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { GodparentVoteList, GodparentEmpty } from "@/components/GodparentVoteList";
import type { Team } from "@/lib/types";

export const metadata = { title: "Parrainage — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function ParrainagePage() {
  const profile = await getMyProfile();
  const student = await getMyStudent();

  if (profile?.role === "admin" && !student) redirect("/admin");
  if (!student) redirect("/login-student");
  // Page réservée aux comptes MP/PSI (spectateurs → candidats parrains)
  if (student.track !== "mpsi2") redirect("/videos");

  const supabase = await createClient();

  // Équipes ayant publié leur vidéo de présentation (aucune vérification)
  const [teamsRes, offersRes, unreadRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, emoji, presentation_video_path, godparent_student_id")
      .not("presentation_video_path", "is", null)
      .order("created_at"),
    supabase
      .from("godparent_offers")
      .select("team_id")
      .eq("student_id", student.id),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", student.id)
      .eq("read", false),
  ]);

  const teams = (teamsRes.data ?? []) as Array<
    Pick<Team, "id" | "name" | "emoji" | "presentation_video_path"> & {
      godparent_student_id: string | null;
    }
  >;

  const myVotes = new Set(
    ((offersRes.data ?? []) as { team_id: string }[]).map((o) => o.team_id)
  );

  // Noms des parrains déjà choisis
  const godparentIds = [
    ...new Set(
      teams.map((t) => t.godparent_student_id).filter((id): id is string => !!id)
    ),
  ];
  const godparentNames = new Map<string, string>();
  if (godparentIds.length > 0) {
    const { data: chosen } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .in("id", godparentIds);
    for (const s of (chosen ?? []) as Array<{
      id: string;
      first_name: string;
      last_name: string | null;
    }>) {
      godparentNames.set(
        s.id,
        s.last_name ? `${s.first_name} ${s.last_name}` : s.first_name
      );
    }
  }

  const items = teams.map((t) => ({
    teamId: t.id,
    name: t.name,
    emoji: t.emoji,
    videoPath: t.presentation_video_path as string,
    voted: myVotes.has(t.id),
    chosenName: t.godparent_student_id
      ? (godparentNames.get(t.godparent_student_id) ?? null)
      : null,
    canVote: !t.godparent_student_id,
  }));

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 md:max-w-3xl md:pt-8">
      <TopBar unread={unreadRes.count ?? 0} isAdmin={profile?.role === "admin"} />
      <BottomNav />

      <div className="mt-4 md:mt-0">
        <h1 className="text-2xl font-black tracking-tight text-white">
          🕊️ Choix du parrain
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Regarde chaque équipe se présenter, puis décide si tu veux être son
          parrain. Ton choix n&apos;est définitif que lorsque l&apos;équipe te
          sélectionne.
        </p>
      </div>

      <div className="mt-5">
        {items.length === 0 ? (
          <GodparentEmpty />
        ) : (
          <GodparentVoteList teams={items} />
        )}
      </div>
    </div>
  );
}
