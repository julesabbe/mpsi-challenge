import Link from "next/link";

export const metadata = { title: "Bienvenue — MPSI Challenge" };

export default function WelcomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="animate-rise w-full max-w-md">
        <span className="block text-7xl" aria-hidden>
          🏁
        </span>
        <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-white">
          MPSI{" "}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            CHALLENGE
          </span>
        </h1>
        <p className="mt-3 text-zinc-400">
          Bienvenue dans le challenge d&apos;intégration. Forme ton équipe,
          réalise des défis et grimpe au sommet du classement. 🏆
        </p>

        <div className="mt-8 flex justify-center gap-3 text-3xl" aria-hidden>
          <span className="animate-pop" style={{ animationDelay: "0.1s" }}>
            🎯
          </span>
          <span className="animate-pop" style={{ animationDelay: "0.25s" }}>
            🎥
          </span>
          <span className="animate-pop" style={{ animationDelay: "0.4s" }}>
            🏆
          </span>
        </div>

        <Link href="/register" className="btn-primary mt-10 text-lg tracking-wide">
          S&apos;INSCRIRE
        </Link>
        <Link href="/login-student" className="btn-ghost mt-3 block w-full text-center font-semibold">
          J&apos;AI DÉJÀ UN COMPTE
        </Link>

        <p className="mt-6 text-xs text-zinc-500">
          Super Admin ?{" "}
          <Link href="/login" className="text-violet-300 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
