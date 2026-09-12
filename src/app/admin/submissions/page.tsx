import { createClient } from "@/lib/supabase/server";
import { getTeamScores } from "@/lib/queries";
import { SubmissionsManager } from "./manager";
import { AdminPresentations, type PresentationRow } from "./presentations";
import type { Student, Submission } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  const supabase = await createClient();
  const [subsRes, scores, studentsRes] = await Promise.all([
    supabase
      .from("submissions")
      .select(
        "*, teams(id, name, emoji), challenges(id, title, points, difficulty, category), students(id, first_name, last_name)"
      )
      .order("submitted_at", { ascending: false })
      .limit(200),
    getTeamScores(),
    // Les identités des parrains ne sont pas dans les lignes d'équipe :
    // on résout les noms depuis la liste des élèves.
    supabase.from("students").select("id, first_name, last_name, track"),
  ]);

  const nameById = new Map<string, string>();
  for (const s of (studentsRes.data ?? []) as Student[]) {
    nameById.set(
      s.id,
      s.last_name ? `${s.first_name} ${s.last_name}` : s.first_name
    );
  }

  // Une carte par équipe, les présentations publiées en tête.
  const presentations: PresentationRow[] = scores
    .map((row) => ({
      teamId: row.team.id,
      teamName: row.team.name,
      teamEmoji: row.team.emoji,
      members: row.members.map((m) =>
        m.last_name ? `${m.first_name} ${m.last_name}` : m.first_name
      ),
      videoPath: row.team.presentation_video_path ?? null,
      uploadedAt: row.team.presentation_uploaded_at ?? null,
      godparentName: row.team.godparent_student_id
        ? nameById.get(row.team.godparent_student_id) ?? "Parrain"
        : null,
    }))
    .sort((a, b) => {
      const aHas = a.videoPath ? 0 : 1;
      const bHas = b.videoPath ? 0 : 1;
      return aHas - bHas || a.teamName.localeCompare(b.teamName);
    });

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-white">
        🎥 Soumissions
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        Visionnez les vidéos et validez ou refusez les défis. Les points sont
        crédités automatiquement après validation.
      </p>
      <SubmissionsManager submissions={(subsRes.data ?? []) as Submission[]} />

      <AdminPresentations rows={presentations} />
    </div>
  );
}
