import { redirect } from "next/navigation";
import { getMyStudent, getMyTeam } from "@/lib/queries";

export const metadata = { title: "Équipes — MPSI Challenge" };
export const dynamic = "force-dynamic";

/** Ancien flux : la création d'équipe se fait désormais via une case sur /teams. */
export default async function CreateTeamPage() {
  const student = await getMyStudent();
  if (!student) redirect("/login-student");
  const team = await getMyTeam(student.id);
  redirect(team ? "/dashboard" : "/teams");
}
