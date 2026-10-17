import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  Copyright,
  FileText,
  LifeBuoy,
  MessagesSquare,
  Percent,
  Receipt,
  ShieldAlert,
  Store,
} from "lucide-react";

import { Alert, EmptyState } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Help centre",
  description: "Policies, refund requests, reporting and support tickets.",
};

const TOPICS = [
  {
    href: "/legal/refunds",
    icon: Receipt,
    title: "Refund policy",
    description: "When a refund can be requested on a digital purchase and how it is processed.",
  },
  {
    href: "/support/new",
    icon: MessagesSquare,
    title: "Contact support",
    description: "Open a ticket about an order, a download or your account.",
  },
  {
    href: "/report",
    icon: ShieldAlert,
    title: "Report a product",
    description: "Report a listing that is misleading, broken or malicious.",
  },
  {
    href: "/legal/copyright",
    icon: Copyright,
    title: "Copyright complaints",
    description: "What a notice needs to contain before staff can act on it.",
  },
  {
    href: "/legal/seller-agreement",
    icon: Store,
    title: "Seller agreement",
    description: "The terms sellers accept, including commission and payout handling.",
  },
  {
    href: "/legal/fees",
    icon: Percent,
    title: "Fees & commissions",
    description: "How the platform commission is resolved, recorded and paid out.",
  },
  {
    href: "/legal/terms",
    icon: FileText,
    title: "Terms of Service",
    description: "The rules for using the marketplace as a buyer or a seller.",
  },
  {
    href: "/legal/privacy",
    icon: FileText,
    title: "Privacy & cookies",
    description: "What personal data is stored, why, and how to exercise your rights.",
  },
];

export default async function SupportPage() {
  const user = await getSessionUser();

  const tickets = user
    ? await prisma.supportTicket.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      })
    : [];

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
            <LifeBuoy className="size-4 text-accent" aria-hidden />
            Help centre
          </h1>
          <p className="muted mt-1 max-w-2xl text-[12.5px] leading-relaxed">
            Policies, refund requests and reporting. Support tickets are answered by platform staff
            — sellers cannot see the tickets you file about them.
          </p>
        </div>
        <Link href="/support/new" className={buttonClass("primary", "sm")}>
          Contact support
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOPICS.map((topic) => (
          <Link key={topic.href} href={topic.href} className="surface p-3.5 transition-colors hover:border-line-strong">
            <topic.icon className="size-4 text-accent" aria-hidden />
            <p className="mt-2 text-[13px] font-medium">{topic.title}</p>
            <p className="muted mt-1 text-[11.5px] leading-relaxed">{topic.description}</p>
          </Link>
        ))}
      </section>

      <Card>
        <CardHeader
          title="Your tickets"
          description={
            user
              ? "Tickets you have opened, newest activity first."
              : "Sign in to see the tickets you have opened."
          }
        />
        {!user ? (
          <CardBody className="space-y-3">
            <Alert tone="info">
              You can read every policy without an account. A ticket needs a signed-in account so
              staff can reply to you and see your orders.
            </Alert>
            <Link href="/login?next=%2Fsupport" className={buttonClass("primary", "sm")}>
              Sign in
            </Link>
          </CardBody>
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No tickets yet"
            description="Nothing has been escalated to platform staff from this account."
            icon={<MessagesSquare className="size-5" aria-hidden />}
            action={
              <Link href="/support/new" className={buttonClass("primary", "sm")}>
                Open a ticket
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/support/${ticket.ticketNumber}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{ticket.subject}</p>
                    <p className="subtle mt-0.5 text-[11.5px] tabular-nums">
                      {ticket.ticketNumber} · {ticket._count.messages}{" "}
                      {ticket._count.messages === 1 ? "message" : "messages"} · updated{" "}
                      {ticket.updatedAt.toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <StatusBadge status={ticket.status} />
                  <ChevronRight className="size-3.5 text-ink-subtle" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
