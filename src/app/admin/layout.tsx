import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/queries";
import { AdminNav } from "@/components/admin/AdminNav";
import { BackButton } from "@/components/BackButton";

export const metadata = { title: "Admin — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getMyProfile();
  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-dvh">
      <AdminNav />
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-6 md:px-8 md:pb-10">
          <div className="mb-4">
            <BackButton fallback="/admin" label="Retour" />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
