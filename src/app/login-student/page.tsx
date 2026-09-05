import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/queries";
import { LoginStudentForm } from "./form";

export const metadata = { title: "Connexion élève — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function LoginStudentPage() {
  const profile = await getMyProfile();
  if (profile?.role === "admin") redirect("/admin");

  // Pas de redirection élève ici : on peut basculer de compte sur le même
  // appareil (déconnexion puis sélection d'un autre élève).

  const supabase = await createClient();
  // Vue publique : uniquement les noms, jamais les mots de passe.
  const { data } = await supabase
    .from("student_login_list")
    .select("id, first_name, last_name, track")
    .order("first_name");

  return (
    <LoginStudentForm
      students={
        (data ?? []) as Array<{
          id: string;
          first_name: string;
          last_name: string | null;
          track: "mpsi" | "mpsi2";
        }>
      }
    />
  );
}