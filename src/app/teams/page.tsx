import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyStudent, getMyTeam } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { SlotsGrid, type Slot } from "./slots-grid";

export const metadata = { title: "Équipes — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const profile = await getMyProfile();
  const student = await getMyStudent();

  if (profile?.role === "admin" && !student) redirect("/admin");
  if (!student) redirect("/select-student");

  const supabase = await createClient();
  const team = await getMyTeam(student.id);

  // Cases + équipes + membres
  const [slotsRes, membersRes, unreadRes] = await Promise.all([
    supabase
      .from("team_slots")
      .select("slot_number, team_id, teams(id, name, emoji)")
      .order("slot_number"),
    supabase
      .from("team_members")
      .select("team_id, students(id, first_name, last_name)"),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", student.id)
      .eq("read", false),
  ]);

  type SlotRow = {
    slot_number: number;
    team_id: string | null;
    teams: { id: string; name: string; emoji: string } | null;
  };
  type MemberRow = {
    team_id: string;
    students: { id: string; first_name: string; last_name: string | null } | null;
  };

  const membersByTeam = new Map<string, { id: string; name: string }[]>();
  for (const m of (membersRes.data ?? []) as unknown as MemberRow[]) {
    if (!m.students) continue;
    const list = membersByTeam.get(m.team_id) ?? [];
    list.push({
      id: m.students.id,
      name: m.students.last_name
        ? `${m.students.first_name} ${m.students.last_name}`
        : m.students.first_name,
    });
    membersByTeam.set(m.team_id, list);
  }

  const slots: Slot[] = ((slotsRes.data ?? []) as unknown as SlotRow[]).map((r) => ({
    slot_number: r.slot_number,
    team: r.teams ? { id: r.teams.id, name: r.teams.name, emoji: r.teams.emoji } : null,
    members: r.team_id ? membersByTeam.get(r.team_id) ?? [] : [],
  }));

  const isMpsi = student.track === "mpsi";

  // Coéquipiers disponibles : MPSI uniquement, sans équipe, hors moi
  const { data: pool } = await supabase
    .from("students")
    .select("id, first_name, last_name, track, active")
    .eq("active", true)
    .eq("track", "mpsi");
  const inTeam = new Set(
    (((membersRes.data ?? []) as unknown as MemberRow[]).map((m) => m.students?.id)).filter(
      Boolean
    ) as string[]
  );
  const availableTeammates = ((pool ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string | null;
  }>)
    .filter((s) => s.id !== student.id && !inTeam.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.last_name ? `${s.first_name} ${s.last_name}` : s.first_name,
    }));

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 md:max-w-3xl md:pt-8">
      <TopBar unread={unreadRes.count ?? 0} isAdmin={profile?.role === "admin"} />
      <BottomNav />

      <div className="mt-4 md:mt-0">
        <h1 className="text-2xl font-black tracking-tight text-white">
          👥 Les 15 équipes
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {team
            ? "Ton équipe occupe une case. Les autres cases sont à eux de jouer !"
            : isMpsi
              ? "Choisis une case libre et forme ton équipe de 3 (toi inclus)."
              : "Les équipes MPSI occupent les 15 cases. En MP/PSI, tu peux suivre la compétition."}
        </p>
      </div>

      <div className="mt-5">
        {!isMpsi && !team ? (
          <EmptyState
            icon="⚙️"
            title="Les équipes sont réservées aux MPSI"
            hint="Ton compte MP/PSI te permet de suivre le classement, les défis et les équipes."
          />
        ) : (
          <SlotsGrid
            slots={slots}
            me={{
              id: student.id,
              name: student.last_name
                ? `${student.first_name} ${student.last_name}`
                : student.first_name,
            }}
            availableTeammates={team ? [] : availableTeammates}
            myTeamId={team?.id ?? null}
          />
        )}
      </div>
    </div>
  );
}
