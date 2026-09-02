import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyStudent, getMyTeam } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Racine : résout la destination selon l'état de l'appareil/du compte.
 *  - aucune session              → /guest (mode invité)
 *  - admin sans identité élève   → /admin
 *  - élève sans équipe           → /create-team
 *  - élève avec équipe           → /dashboard
 *  - session anonyme sans choix  → /select-student
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/guest");

  const profile = await getMyProfile();
  const student = await getMyStudent();

  if (profile?.role === "admin" && !student) redirect("/admin");

  if (!student) redirect("/select-student");

  const team = await getMyTeam(student.id);
  redirect(team ? "/dashboard" : "/create-team");
}
