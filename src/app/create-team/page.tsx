import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getMyTeam } from "@/lib/queries";
import { CreateTeamForm } from "./form";

export const metadata = { title: "Forme ton équipe — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function CreateTeamPage() {
  const student = await getMyStudent();
  if (!student) redirect("/select-student");

  const team = await getMyTeam(student.id);
  if (team) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("active", true)
    .order("first_name");

  const { data: inTeam } = await supabase
    .from("team_members")
    .select("student_id");
  const taken = new Set(
    ((inTeam ?? []) as { student_id: string }[]).map((r) => r.student_id)
  );

  const others = ((data ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string | null;
  }>)
    .filter((s) => s.id !== student.id && !taken.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.last_name ? `${s.first_name} ${s.last_name}` : s.first_name,
    }));

  return <CreateTeamForm me={student} others={others} />;
}
