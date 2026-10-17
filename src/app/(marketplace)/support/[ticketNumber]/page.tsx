import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Headset } from "lucide-react";

import { TicketReplyForm } from "@/components/support/ticket-forms";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { replyToTicketAction } from "@/lib/support/actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ ticketNumber: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticketNumber } = await params;
  return { title: `Ticket ${ticketNumber}` };
}

export default async function TicketPage({ params }: PageProps) {
  const { ticketNumber } = await params;
  const user = await requireUser(`/support/${ticketNumber}`);

  // The owner filter is the authorisation boundary: a ticket number alone must
  // never be enough to read someone else's conversation with staff.
  const ticket = await prisma.supportTicket.findFirst({
    where: { ticketNumber, userId: user.id },
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      closedAt: true,
      order: { select: { orderNumber: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, isStaff: true, createdAt: true },
      },
    },
  });

  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6">
      <Link
        href="/support"
        className="subtle mb-4 inline-flex items-center gap-1.5 text-[12px] hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Help centre
      </Link>

      <Card>
        <CardHeader
          title={ticket.subject}
          description={`${ticket.ticketNumber} · opened ${ticket.createdAt.toISOString().slice(0, 10)}`}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              {ticket.priority !== "NORMAL" ? (
                <Badge tone={ticket.priority === "URGENT" ? "critical" : "caution"}>
                  {ticket.priority.toLowerCase()} priority
                </Badge>
              ) : null}
              <StatusBadge status={ticket.status} />
            </div>
          }
        />

        {ticket.order ? (
          <CardBody className="border-b border-line py-3">
            <p className="muted text-[12.5px]">
              Related order{" "}
              <Link href="/account/orders" className="text-accent hover:underline">
                {ticket.order.orderNumber}
              </Link>
            </p>
          </CardBody>
        ) : null}

        <CardBody className="space-y-3">
          {ticket.messages.map((message) => (
            <div
              key={message.id}
              className={
                message.isStaff
                  ? "surface-elevated p-3.5"
                  : "rounded-[8px] border border-line/70 bg-canvas p-3.5"
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11.5px] font-medium">
                  {message.isStaff ? (
                    <>
                      <Headset className="size-3.5 text-accent" aria-hidden />
                      Platform staff
                    </>
                  ) : (
                    <>You · @{user.username}</>
                  )}
                </span>
                <span className="subtle text-[11px] tabular-nums">
                  {message.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </div>
              <p className="muted mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed">
                {message.body}
              </p>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="mt-5">
        {ticket.closedAt || ticket.status === "CLOSED" ? (
          <Alert tone="info">
            This ticket is closed and cannot receive further replies.{" "}
            <Link href="/support/new" className="text-accent hover:underline">
              Open a new ticket
            </Link>{" "}
            if the problem is still present.
          </Alert>
        ) : (
          <Card>
            <CardHeader
              title="Reply"
              description="Replying moves the ticket back into the staff queue."
            />
            <CardBody>
              <TicketReplyForm action={replyToTicketAction} ticketId={ticket.id} />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
