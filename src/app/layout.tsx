import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { getMyProfile, getMyStudent } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { SupabaseProvider } from "@/lib/supabase/provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "MPSI Challenge",
  description:
    "Le challenge d'intégration MPSI : formes ton équipe, réalise des défis, grimpe au classement.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MPSI Challenge",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getMyProfile();
  const student = await getMyStudent();

  let unread = 0;
  if (student) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", student.id)
      .eq("read", false);
    unread = count ?? 0;
  }

  return (
    <html lang="fr" className={geist.variable}>
      <body className="min-h-dvh bg-zinc-950 font-sans text-zinc-100 antialiased">
        <SupabaseProvider unread={unread} isAdmin={profile?.role === "admin"}>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}

export const dynamic = "force-dynamic";
