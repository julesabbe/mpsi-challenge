import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Student, Team } from "@/lib/types";

/**
 * Toutes les identités élèves liées au compte auth connecté (session
 * Supabase — fonctionne depuis n'importe quel appareil). Un même compte peut
 * être à la fois Super Admin, élève MPSI et élève MP/PSI.
 */
export async function getMyStudents(): Promise<Student[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("profiles")
    .select("student_id, students(*)")
    .eq("auth_user_id", user.id);
  const students = ((data ?? []) as unknown as Array<{
    students: Student | null;
  }>)
    .map((r) => r.students)
    .filter((s): s is Student => !!s && s.active);

  // MPSI d'abord, puis MP/PSI
  students.sort((a, b) =>
    a.track === b.track ? 0 : a.track === "mpsi" ? -1 : 1
  );
  return students;
}

/**
 * Élève « actif » du compte connecté : celui choisi via le cookie mc_track
 * (MPSI ou MP/PSI), sinon le seul existant, sinon le premier. Renvoie null
 * si aucun compte élève n'est lié.
 */
export async function getMyStudent(): Promise<Student | null> {
  const students = await getMyStudents();
  if (students.length === 0) return null;
  if (students.length === 1) return students[0];
  const cookieStore = await cookies();
  const chosen = cookieStore.get("mc_track")?.value;
  return (
    students.find((s) => s.track === chosen) ?? students[0]
  );
}

/** Profil du compte courant — côté serveur (préfère le rôle admin). */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id);
  const profiles = (data ?? []) as Profile[];
  if (profiles.length === 0) return null;
  return profiles.find((p) => p.role === "admin") ?? profiles[0];
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
