import { createClient } from "@/lib/supabase/server";
import { StudentsManager } from "./manager";
import type { Student } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  const supabase = await createClient();
  const [studentsRes, membersRes, profilesRes] = await Promise.all([
    supabase.from("students").select("*").order("first_name"),
    supabase.from("team_members").select("team_id, student_id, teams(name)"),
    supabase.from("profiles").select("student_id, auth_user_id"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-white">👥 Élèves</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Ajoutez, modifiez ou supprimez les élèves. Un élève lié à un compte ne
        peut pas être supprimé : désactivez-le.
      </p>
      <StudentsManager
        students={(studentsRes.data ?? []) as Student[]}
        teamByStudent={Object.fromEntries(
          ((membersRes.data ?? []) as unknown as Array<{
            student_id: string;
            teams: { name: string } | null;
          }>).map((m) => [m.student_id, m.teams?.name ?? null])
        )}
        linkedAuthIds={new Set(
          ((profilesRes.data ?? []) as { student_id: string | null }[])
            .filter((p) => p.student_id)
            .map((p) => p.student_id as string)
        )}
      />
    </div>
  );
}
