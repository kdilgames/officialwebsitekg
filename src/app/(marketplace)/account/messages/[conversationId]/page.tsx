import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { MessageReplyForm } from "@/components/marketplace/message-forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { sendDirectMessageAction } from "@/lib/messages/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conversation" };

export default async function BuyerConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const [user, { conversationId }] = await Promise.all([
    requireUser("/account/messages"),
    params,
  ]);

  const conversation = await withSchemaFallback(
    () =>
      prisma.conversation.findFirst({
        where: { id: conversationId, buyerId: user.id },
        include: {
          seller: { select: { storeName: true, slug: true, userId: true } },
          product: { select: { title: true, slug: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            include: { sender: { select: { username: true, displayName: true } } },
          },
        },
      }),
    null,
  );

  if (!conversation) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/account/messages"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to messages
      </Link>

      <Card>
        <CardHeader
          title={conversation.subject}
          description={`Conversation with ${conversation.seller.storeName}${conversation.product ? ` · ${conversation.product.title}` : ""}`}
        />
        <CardBody className="space-y-3">
          {conversation.messages.map((msg) => {
            const mine = msg.senderId === user.id;
            return (
              <div
                key={msg.id}
                className={`rounded-lg border p-3 text-[13px] ${
                  mine
                    ? "ml-6 border-accent/30 bg-accent/5"
                    : "mr-6 border-line bg-elevated"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="font-semibold text-ink">
                    {mine ? "You" : conversation.seller.storeName}
                  </span>
                  <span className="subtle">
                    {msg.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-ink">{msg.body}</p>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <MessageReplyForm action={sendDirectMessageAction} conversationId={conversation.id} />
        </CardBody>
      </Card>
    </div>
  );
}
