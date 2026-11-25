import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";

import { EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/marketplace/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

const TYPE_LABELS: Record<string, string> = {
  ORDER: "Order",
  PAYOUT: "Payout",
  REVIEW: "Review",
  REFUND: "Refund",
  SUPPORT: "Support",
  MODERATION: "Moderation",
  QUESTION: "Q&A",
  SYSTEM: "Release / System",
};

export default async function NotificationsPage() {
  const user = await requireUser("/account/notifications");

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });

  const unreadCount = notifications.filter((item) => item.readAt === null).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Notifications</h1>
          <p className="muted mt-1 text-[12.5px]">
            Product update alerts, Q&amp;A replies, order confirmations, and store notices.
          </p>
        </div>
        {unreadCount > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="secondary" size="sm">
              <CheckCheck className="size-3.5" aria-hidden />
              Mark all read ({unreadCount})
            </Button>
          </form>
        ) : null}
      </header>

      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="size-5" aria-hidden />}
            title="You are all caught up"
            description="When a creator releases a new version of a product you own or answers your question, it shows up here."
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {notifications.map((item) => {
              const isUnread = item.readAt === null;

              return (
                <li
                  key={item.id}
                  className={isUnread ? "bg-elevated/60 px-4 py-3.5" : "px-4 py-3.5"}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isUnread ? (
                          <span
                            className="size-2 shrink-0 rounded-full bg-accent"
                            aria-label="Unread"
                          />
                        ) : null}
                        <Badge tone={isUnread ? "accent" : "neutral"}>
                          {TYPE_LABELS[item.type] ?? item.type}
                        </Badge>
                        {item.href ? (
                          <Link
                            href={item.href}
                            className="text-[13.5px] font-semibold text-ink hover:text-accent"
                          >
                            {item.title}
                          </Link>
                        ) : (
                          <span className="text-[13.5px] font-semibold text-ink">{item.title}</span>
                        )}
                      </div>
                      <p className="muted mt-1 text-[12.5px] leading-relaxed">{item.body}</p>
                      <p className="subtle mt-1 text-[11px] tabular-nums">
                        {item.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="text-[12px] font-medium text-accent hover:underline"
                        >
                          View
                        </Link>
                      ) : null}
                      {isUnread ? (
                        <form action={markNotificationReadAction}>
                          <input type="hidden" name="notificationId" value={item.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Mark read
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
