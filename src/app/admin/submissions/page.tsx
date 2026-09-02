import { createClient } from "@/lib/supabase/server";
import { SubmissionsManager } from "./manager";
import type { Submission } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("submissions")
    .select(
      "*, teams(id, name, emoji), challenges(id, title, points, difficulty, category), students(id, first_name, last_name)"
    )
    .order("submitted_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-white">
        🎥 Soumissions
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        Visionnez les vidéos et validez ou refusez les défis. Les points sont
        crédités automatiquement après validation.
      </p>
      <SubmissionsManager submissions={(data ?? []) as Submission[]} />
    </div>
  );
}
