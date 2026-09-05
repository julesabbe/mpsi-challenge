import { createClient } from "@/lib/supabase/server";
import { getTeamScores } from "@/lib/queries";
import { TeamsManager } from "./manager";
import type { Student } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  const supabase = await createClient();
  const [scores, studentsRes] = await Promise.all([
    getTeamScores(),
    supabase
      .from("students")
      .select("id, first_name, last_name, active")
      .eq("active", true)
      // Seuls les élèves MPSI peuvent être membres d'une équipe
      .eq("track", "mpsi")
      .order("first_name"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-white">🏆 Équipes</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Modifiez les équipes, échangez des membres ou dissolvez une équipe.
      </p>
      <TeamsManager
        rows={scores}
        students={(studentsRes.data ?? []) as Student[]}
      />
    </div>
  );
}
