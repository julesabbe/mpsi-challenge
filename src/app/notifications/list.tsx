"use client";

import { useEffect } from "react";
import { cx } from "@/lib/utils";
import { useSupabaseCtx } from "@/lib/supabase/provider";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  time: string;
};

export function NotificationsList({
  notifications,
  hasUnread,
}: {
  notifications: NotificationItem[];
  hasUnread: boolean;
}) {
  const { supabase } = useSupabaseCtx();

  // Marquer comme lues à l'ouverture
  useEffect(() => {
    if (!hasUnread) return;
    const timer = setTimeout(() => {
      supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false)
        .then(() => undefined);
    }, 1200);
    return () => clearTimeout(timer);
  }, [hasUnread, supabase]);

  return (
    <div className="space-y-2">
      {notifications.map((n, i) => (
        <div
          key={n.id}
          className={cx(
            "card animate-rise flex gap-3 p-4",
            !n.read && "border-violet-500/40 bg-violet-500/[0.07]"
          )}
          style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
        >
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white">{n.title}</p>
            <p className="mt-0.5 text-sm text-zinc-400">{n.message}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-600">
              {n.time}
            </p>
          </div>
          {!n.read ? (
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-violet-500" />
          ) : null}
        </div>
      ))}
    </div>
  );
}
