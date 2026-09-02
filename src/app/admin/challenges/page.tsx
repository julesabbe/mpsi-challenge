import { createClient } from "@/lib/supabase/server";
import { ChallengesManager } from "./manager";
import type { Challenge } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminChallengesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("challenges")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-white">🎯 Défis</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Créez et gérez les défis de la compétition.
      </p>
      <ChallengesManager challenges={(data ?? []) as Challenge[]} />
    </div>
  );
}
