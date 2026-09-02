import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getMyTeam, getMyProfile } from "@/lib/queries";
import { SelectStudentForm } from "./form";
import type { Student } from "@/lib/types";

export const metadata = { title: "Qui es-tu ? — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function SelectStudentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pas de session du tout → /guest
  if (!user) redirect("/guest");

  const profile = await getMyProfile();
  const student = await getMyStudent();
  const team = await getMyTeam(student?.id ?? null);

  // Redirections selon l'avancement
  if (profile?.role === "admin" && !student) redirect("/admin");
  if (team) redirect("/dashboard");
  if (student) redirect("/create-team");

  const { data } = await supabase
    .from("students")
    .select("id, first_name, last_name, anon_user_id")
    .eq("active", true)
    .order("first_name");

  const { data: inTeam } = await supabase.from("team_members").select("student_id");
  const inTeamIds = new Set(
    ((inTeam ?? []) as { student_id: string }[]).map((r) => r.student_id)
  );

  const available = ((data ?? []) as unknown as Student[]).filter(
    (s) => !inTeamIds.has(s.id)
  );

  return <SelectStudentForm available={available} />;
}
