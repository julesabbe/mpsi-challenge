import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getTeamScores,
  getMyProfile,
  getMyStudent,
  getMyTeam,
} from "@/lib/queries";
import { LeaderboardList } from "@/components/LeaderboardList";
import { EmptyState } from "@/components/EmptyState";
import {
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  DIFFICULTY_EMOJI,
  DIFFICULTY_LABELS,
  type Challenge,
} from "@/lib/types";
import { formatPoints } from "@/lib/utils";

export const metadata = { title: "MPSI Challenge" };
export const dynamic = "force-dynamic";

/** Page d'accueil publique — c'est la page affichée par défaut sur /. */
export default async function GuestPage() {
  const supabase = await createClient();
  const [scores, chRes] = await Promise.all([
    getTeamScores(),
    supabase
      .from("challenges")
      .select("*")
      .eq("active", true)
      .order("points", { ascending: false })
      .limit(6),
  ]);

  // Page d'accueil publique : PAS de redirection automatique. Une session
  // existante n'est utilisée que pour afficher un raccourci vers l'espace
  // personnel — personne n'est connecté d'office.
  const profile = await getMyProfile();
  const student = await getMyStudent();

  const challenges = (chRes.data ?? []) as unknown as Challenge[];

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-10">
      <div className="animate-rise text-center">
        <span className="text-6xl" aria-hidden>
          🏁
        </span>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
          MPSI{" "}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            CHALLENGE
          </span>
        </h1>
        <p className="mt-2 text-zinc-400">
          Bienvenue dans le challenge d&apos;intégration.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {/* Session existante : simple raccourci, jamais de connexion forcée */}
        {profile?.role === "admin" && !student ? (
          <Link href="/admin" className="btn-ghost block w-full text-center text-base font-semibold">
            🛡️ ESPACE SUPER ADMIN
          </Link>
        ) : student ? (
          <div className="space-y-3">
            <Link href="/dashboard" className="btn-ghost block w-full text-center text-base font-semibold">
              👋 REPRENDRE ({student.first_name})
            </Link>
            {profile?.role === "admin" ? (
              <Link href="/admin" className="btn-ghost block w-full text-center text-base font-semibold">
                🛡️ ESPACE SUPER ADMIN
              </Link>
            ) : null}
          </div>
        ) : null}
        <Link href="/register" className="btn-primary text-lg">
          S&apos;INSCRIRE
        </Link>
        <Link href="/login-student" className="btn-ghost block w-full text-center text-base font-semibold">
          J&apos;AI DÉJÀ UN COMPTE
        </Link>
        <p className="mt-4 text-center text-xs text-zinc-500">
          Les défis, les équipes et le classement sont visibles ci-dessous,
          inscrit ou non.
        </p>
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">🏆 Classement</h2>
        </div>
        {scores.length === 0 ? (
          <EmptyState
            icon="🏁"
            title="Les équipes commencent bientôt la compétition."
          />
        ) : (
          <LeaderboardList rows={scores.slice(0, 5)} />
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-extrabold text-white">
          🎯 Quelques défis
        </h2>
        <div className="grid gap-3">
          {challenges.slice(0, 3).map((c) => (
            <div key={c.id} className="card animate-rise p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                  {CATEGORY_EMOJI[c.category]} {CATEGORY_LABELS[c.category]}
                </p>
                <span className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-2.5 py-1 text-xs font-black text-white">
                  +{formatPoints(c.points)}
                </span>
              </div>
              <h3 className="mt-2 font-bold text-white">{c.title}</h3>
              <p className="mt-2 text-xs text-zinc-500">
                {DIFFICULTY_EMOJI[c.difficulty]} {DIFFICULTY_LABELS[c.difficulty]}
              </p>
            </div>
          ))}
        </div>
        {challenges.length === 0 ? (
          <EmptyState icon="👀" title="Les défis arrivent bientôt" />
        ) : null}
      </section>

      <p className="mt-10 text-center text-xs text-zinc-600">
        Super Admin ?{" "}
        <Link href="/login" className="hover:text-zinc-400">
          Connexion
        </Link>
      </p>
    </div>
  );
}
