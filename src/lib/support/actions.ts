"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  errorState,
  formToObject,
  successState,
  toFieldErrors,
  type ActionState,
} from "@/lib/action-state";
import { notify, recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { ticketReplySchema, ticketSchema } from "@/lib/validation";

/** Ticket numbers are human-readable references; the id remains the real key. */
function ticketNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `SUP-${stamp}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * Opens a support ticket for the signed-in user.
 *
 * The optional order reference is verified to belong to the caller before it is
 * attached, so a ticket can never be filed against someone else's order.
 */
export async function createTicketAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/support/new");

  const parsed = ticketSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }
  const { subject, body, priority, orderId } = parsed.data;

  const limit = await rateLimit(`ticket:${user.id}`, 6, 60 * 60);
  if (!limit.ok) {
    return errorState("You have opened several tickets recently. Please wait before filing another.");
  }

  if (orderId) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, buyerId: user.id },
      select: { id: true },
    });
    if (!order) return errorState("That order does not belong to your account.");
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber: ticketNumber(),
      userId: user.id,
      orderId: orderId ?? null,
      subject,
      priority,
      messages: { create: { authorId: user.id, body, isStaff: false } },
    },
    select: { id: true, ticketNumber: true },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "ticket.created",
    entityType: "SupportTicket",
    entityId: ticket.id,
    after: { subject, priority, orderId: orderId ?? null },
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  for (const admin of admins) {
    await notify({
      userId: admin.id,
      type: "TICKET",
      title: `New ticket ${ticket.ticketNumber}`,
      body: subject,
      href: "/admin/tickets",
    });
  }

  revalidatePath("/support");
  redirect(`/support/${ticket.ticketNumber}`);
}

/** Adds a buyer's follow-up message and reopens the ticket if staff had replied. */
export async function replyToTicketAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/support");

  const parsed = ticketReplySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  const limit = await rateLimit(`ticket-reply:${user.id}`, 40, 60 * 60);
  if (!limit.ok) return errorState("Too many replies. Please wait a moment.");

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: parsed.data.ticketId, userId: user.id },
    select: { id: true, status: true, assignedToId: true, ticketNumber: true },
  });
  if (!ticket) return errorState("Ticket not found.");
  if (ticket.status === "CLOSED") {
    return errorState("This ticket is closed. Open a new ticket and quote its number.");
  }

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: { ticketId: ticket.id, authorId: user.id, body: parsed.data.body, isStaff: false },
    }),
    // A buyer reply always puts the ticket back in the staff queue, including
    // when staff had marked it resolved.
    prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "OPEN" } }),
  ]);

  if (ticket.assignedToId) {
    await notify({
      userId: ticket.assignedToId,
      type: "TICKET",
      title: `${user.username} replied to ${ticket.ticketNumber}`,
      body: parsed.data.body.slice(0, 160),
      href: "/admin/tickets",
    });
  }

  revalidatePath(`/support/${ticket.ticketNumber}`);
  return successState("Reply sent. Platform staff have been notified.");
}
