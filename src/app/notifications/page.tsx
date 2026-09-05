import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyStudent } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { EmptyState } from "@/components/EmptyState";
import { NotificationsList } from "./list";
import { timeAgo } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";

export const metadata = { title: "Notifications — MPSI Challenge" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const profile = await getMyProfile();
  const student = await getMyStudent();

  if (profile?.role === "admin" && !student) redirect("/admin");
  if (!student) redirect("/login-student");

  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", student.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const notifications = (data ?? []) as AppNotification[];
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 md:max-w-2xl md:pt-8">
      <TopBar unread={0} isAdmin={profile?.role === "admin"} />

      <div className="mt-4 md:mt-0">
        <h1 className="text-2xl font-black tracking-tight text-white">
          🔔 Notifications
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Validations, refus et bonus de points apparaissent ici.
        </p>
      </div>

      <div className="mt-5">
        {notifications.length === 0 ? (
          <EmptyState
            icon="🔕"
            title="Aucune notification"
            hint="Tes défis validés et refusés s'afficheront ici."
          />
        ) : (
          <NotificationsList
            notifications={notifications.map((n) => ({
              id: n.id,
              title: n.title,
              message: n.message,
              read: n.read,
              time: timeAgo(n.created_at),
            }))}
            hasUnread={unread > 0}
          />
        )}
      </div>
    </div>
  );
}
