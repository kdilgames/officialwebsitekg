import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/marketplace/actions";

export type HeaderNotificationItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationsBell({
  notifications,
  unreadCount,
}: {
  notifications: HeaderNotificationItem[];
  unreadCount: number;
}) {
  return (
    <details className="group relative">
      <summary
        className="btn btn-ghost btn-sm relative list-none px-2 sm:px-2.5 [&::-webkit-details-marker]:hidden"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        title="Notifications"
      >
        <Bell className="size-4" aria-hidden />
        {unreadCount > 0 ? (
          <span className="flex size-4 items-center justify-center rounded-full bg-accent-fill text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </summary>

      <div className="surface absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden shadow-lg">
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
          <p className="text-[13px] font-semibold text-ink">
            Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </p>
          {unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button
                type="submit"
                className="flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all read
              </button>
            </form>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[13px] font-medium text-ink">You&apos;re all caught up</p>
            <p className="muted mt-1 text-[12px]">
              Order updates, product releases, and creator replies appear here.
            </p>
          </div>
        ) : (
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {notifications.map((item) => (
              <li
                key={item.id}
                className={`px-3 py-2.5 transition-colors hover:bg-elevated/60 ${
                  item.readAt ? "" : "bg-accent-soft/25"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={item.href ?? "/account/notifications"}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-1.5">
                      {!item.readAt ? (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-accent-fill"
                          aria-hidden
                        />
                      ) : null}
                      <p className="truncate text-[12.5px] font-medium text-ink">
                        {item.title}
                      </p>
                    </div>
                    {item.body ? (
                      <p className="muted mt-0.5 line-clamp-2 text-[12px] leading-snug">
                        {item.body}
                      </p>
                    ) : null}
                    <p className="subtle mt-1 text-[11px] tabular-nums">
                      {item.createdAt.toISOString().slice(0, 10)}
                    </p>
                  </Link>

                  {!item.readAt ? (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="notificationId" value={item.id} />
                      <button
                        type="submit"
                        className="rounded-[6px] p-1 text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
                        title="Mark as read"
                        aria-label="Mark notification as read"
                      >
                        <Check className="size-3.5" aria-hidden />
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-line bg-elevated/40 px-3 py-2 text-center">
          <Link
            href="/account/notifications"
            className="text-[12px] font-medium text-accent hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </div>
    </details>
  );
}
