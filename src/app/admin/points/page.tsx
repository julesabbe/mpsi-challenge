import { createClient } from "@/lib/supabase/server";
import { getTeamScores } from "@/lib/queries";
import { PointsManager } from "./manager";
import type { PointTransaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPointsPage() {
  const supabase = await createClient();
  const [scores, txRes] = await Promise.all([
    getTeamScores(),
    supabase
      .from("point_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-white">💰 Points</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Attribuez des bonus, retirez des points et consultez l&apos;historique
        des transactions. Le score de chaque équipe est la somme de ses
        transactions.
      </p>
      <PointsManager
        rows={scores}
        transactions={(txRes.data ?? []) as PointTransaction[]}
      />
    </div>
  );
}
