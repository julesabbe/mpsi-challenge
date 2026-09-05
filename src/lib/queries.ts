import { createClient } from "@/lib/supabase/server";
import type { Profile, Student, Team } from "@/lib/types";

/**
 * Élève lié au compte auth connecté (session Supabase — fonctionne depuis
 * n'importe quel appareil). Renvoie null si aucun compte élève connecté.
 */
export async function getMyStudent(): Promise<Student | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("student_id, students(*)")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const student = (
    data as unknown as { students: Student | null } | null
  )?.students;
  return student && student.active ? student : null;
}

/** Profil du compte courant — côté serveur. */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();
  return (data as Profile | null) ?? null;
}

/** Équipe de l'élève courant (null si aucune) — côté serveur. */
export async function getMyTeam(studentId: string | null) {
  if (!studentId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("student_id", studentId)
    .maybeSingle();
  if (!data) return null;
  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("id", data.team_id)
    .single();
  return team ?? null;
}

/** Scores de toutes les équipes : points, défis validés/en attente, membres. */
export async function getTeamScores() {
  const supabase = await createClient();

  const [{ data: teams }, { data: members }, { data: tx }, { data: subs }] =
    await Promise.all([
      supabase.from("teams").select("*").order("created_at"),
      supabase
        .from("team_members")
        .select("team_id, students(id, first_name, last_name)"),
      supabase.from("point_transactions").select("team_id, amount"),
      supabase.from("submissions").select("team_id, status"),
    ]);

  const scores = new Map<
    string,
    { points: number; validated: number; pending: number }
  >();
  for (const t of teams ?? []) {
    scores.set(t.id, { points: 0, validated: 0, pending: 0 });
  }
  for (const row of tx ?? []) {
    const s = scores.get(row.team_id);
    if (s) s.points += row.amount;
  }
  for (const row of subs ?? []) {
    const s = scores.get(row.team_id);
    if (!s) continue;
    if (row.status === "approved") s.validated += 1;
    if (row.status === "pending") s.pending += 1;
  }

  const membersByTeam = new Map<string, Student[]>();
  for (const m of members ?? []) {
    const student = (
      m as unknown as { students: Student | null }
    ).students;
    if (!student) continue;
    const list = membersByTeam.get(m.team_id) ?? [];
    list.push(student);
    membersByTeam.set(m.team_id, list);
  }

  const result: Array<{
    team: Team;
    points: number;
    validatedCount: number;
    pendingCount: number;
    members: Student[];
    rank?: number;
  }> = ((teams ?? []) as Team[]).map((team) => ({
    team,
    points: scores.get(team.id)?.points ?? 0,
    validatedCount: scores.get(team.id)?.validated ?? 0,
    pendingCount: scores.get(team.id)?.pending ?? 0,
    members: membersByTeam.get(team.id) ?? [],
  }));

  // Classement : points décroissants, ex æquo départagés par nom
  result.sort((a, b) => b.points - a.points || a.team.name.localeCompare(b.team.name));
  result.forEach((r, i) => {
    r.rank = i + 1;
  });
  return result;
}

export type TeamScoreRow = Awaited<ReturnType<typeof getTeamScores>>[number];
