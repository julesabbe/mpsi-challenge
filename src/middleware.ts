import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Pages publiques : admin, invité, inscription et connexion élèves.
  const publicPaths = [
    "/login",
    "/guest",
    "/welcome",
    "/register",
    "/login-student",
  ];
  const isPublic = publicPaths.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  if (!user && !isPublic) {
    // Page d'accueil publique par défaut — l'inscription/connexion est
    // toujours à l'initiative de l'utilisateur, jamais imposée.
    const url = request.nextUrl.clone();
    url.pathname = "/guest";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  // Déjà connecté qui va sur /login (admin) : on le renvoie à la racine.
  // Les pages élève (/register, /login-student) restent accessibles pour
  // permettre de changer de compte (déconnexion manuelle via le profil).
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js).*)",
  ],
};
