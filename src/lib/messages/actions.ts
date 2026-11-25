"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  errorState,
  formToObject,
  successState,
  toFieldErrors,
  type ActionState,
} from "@/lib/action-state";
import { notify } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isMissingSchemaError } from "@/lib/db-compat";
import { rateLimit } from "@/lib/rate-limit";

const startSchema = z.object({
  sellerId: z.string().uuid("Invalid seller."),
  productId: z.string().uuid().optional().or(z.literal("")),
  subject: z.string().trim().min(3, "Enter a brief subject (3+ characters).").max(120),
  body: z.string().trim().min(5, "Write at least 5 characters.").max(3000),
});

const replySchema = z.object({
  conversationId: z.string().uuid("Invalid conversation."),
  body: z.string().trim().min(1, "Write a message.").max(3000),
});

export async function startConversationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/account/messages");
  const parsed = startSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please complete the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  const rl = await rateLimit(`dm-start:${user.id}`, 12, 60 * 60);
  if (!rl.ok) {
    return errorState("You have started several conversations recently. Please wait before sending more.");
  }

  const { sellerId, productId, subject, body } = parsed.data;
  const seller = await prisma.sellerProfile.findFirst({
    where: { id: sellerId, status: "APPROVED" },
    select: { id: true, userId: true, storeName: true },
  });
  if (!seller) {
    return errorState("That seller storefront is unavailable.");
  }
  if (seller.userId === user.id) {
    return errorState("You cannot send a message to your own store.");
  }

  let conversationId: string;
  try {
    const created = await prisma.conversation.create({
      data: {
        buyerId: user.id,
        sellerId: seller.id,
        productId: productId || null,
        subject,
        lastMessageAt: new Date(),
        messages: {
          create: {
            senderId: user.id,
            body,
          },
        },
      },
      select: { id: true },
    });
    conversationId = created.id;
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return errorState("Messaging tables are awaiting database migration (db:deploy).");
    }
    throw error;
  }

  await notify({
    userId: seller.userId,
    type: "SYSTEM",
    title: `New message from @${user.username}`,
    body: `${subject}: ${body.slice(0, 120)}`,
    href: `/dashboard/messages/${conversationId}`,
  }).catch(() => undefined);

  revalidatePath("/account/messages");
  revalidatePath("/dashboard/messages");
  redirect(`/account/messages/${conversationId}`);
}

export async function sendDirectMessageAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/account/messages");
  const parsed = replySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Write a message before sending.", toFieldErrors(parsed.error.issues));
  }

  const rl = await rateLimit(`dm-send:${user.id}`, 60, 60 * 60);
  if (!rl.ok) {
    return errorState("Too many messages sent recently. Please slow down.");
  }

  const { conversationId, body } = parsed.data;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      subject: true,
      buyerId: true,
      seller: { select: { userId: true, storeName: true } },
    },
  });
  if (!conversation) {
    return errorState("Conversation not found.");
  }

  const isBuyer = conversation.buyerId === user.id;
  const isSeller = conversation.seller.userId === user.id;
  if (!isBuyer && !isSeller) {
    return errorState("You are not a participant in this conversation.");
  }

  await prisma.$transaction([
    prisma.directMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: user.id,
        body,
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  const recipientUserId = isBuyer ? conversation.seller.userId : conversation.buyerId;
  const recipientHref = isBuyer
    ? `/dashboard/messages/${conversation.id}`
    : `/account/messages/${conversation.id}`;

  await notify({
    userId: recipientUserId,
    type: "SYSTEM",
    title: `New reply: ${conversation.subject}`,
    body: `${isSeller ? conversation.seller.storeName : `@${user.username}`}: ${body.slice(0, 120)}`,
    href: recipientHref,
  }).catch(() => undefined);

  revalidatePath(`/account/messages/${conversation.id}`);
  revalidatePath(`/dashboard/messages/${conversation.id}`);
  revalidatePath("/account/messages");
  revalidatePath("/dashboard/messages");
  return successState("Message sent.");
}
