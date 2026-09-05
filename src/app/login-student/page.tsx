import { redirect } from "next/navigation";
import { getMyProfile, getMyStudent, getMyTeam } from "@/lib/queries";
import { LoginStudentForm } from "./form";

export const metadata = { title: "Connexion élève — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function LoginStudentPage() {
  const profile = await getMyProfile();
  const student = await getMyStudent();
  if (profile?.role === "admin" && !student) redirect("/admin");
  if (student) {
    const team = await getMyTeam(student.id);
    redirect(team ? "/dashboard" : "/create-team");
  }
  return <LoginStudentForm />;
}
