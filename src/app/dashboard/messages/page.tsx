import Link from "next/link";
import { MessageSquare } from "lucide-react";

import { Alert, EmptyState } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireSeller } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Buyer messages" };

export default async function SellerMessagesPage() {
  const user = await requireSeller();

  const data = await withSchemaFallback(
    async () => {
      const threads = await prisma.conversation.findMany({
        where: { sellerId: user.sellerProfile.id },
        orderBy: { lastMessageAt: "desc" },
        take: 50,
        include: {
          buyer: { select: { username: true, displayName: true } },
          product: { select: { title: true, slug: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true },
          },
        },
      });
      return { migrated: true, threads };
    },
    { migrated: false, threads: [] },
  );

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
          <MessageSquare className="size-4 text-accent" aria-hidden />
          Buyer messages
        </h1>
        <p className="muted mt-1 text-[12.5px]">
          Direct pre-sale and customer support threads sent to {user.sellerProfile.storeName}.
        </p>
      </header>

      {!data.migrated ? (
        <Alert tone="warning" title="Database migration pending">
          Run <code>npm run db:deploy</code> to enable buyer-seller direct messaging.
        </Alert>
      ) : null}

      {data.migrated && data.threads.length === 0 ? (
        <Card>
          <EmptyState
            title="No buyer messages yet"
            description="When buyers message you from your storefront or product listings, threads appear here."
          />
        </Card>
      ) : null}

      {data.threads.length > 0 ? (
        <Card className="divide-y divide-line overflow-hidden">
          {data.threads.map((thread) => {
            const latest = thread.messages[0];
            return (
              <Link
                key={thread.id}
                href={`/dashboard/messages/${thread.id}`}
                className="block px-4 py-3.5 transition-colors hover:bg-elevated/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold text-ink">{thread.subject}</p>
                  <span className="subtle text-[11.5px]">
                    {thread.lastMessageAt.toISOString().slice(0, 10)}
                  </span>
                </div>
                <p className="muted mt-0.5 text-[12px]">
                  Buyer: <span className="font-medium text-ink">@{thread.buyer.username}</span>
                  {thread.product ? ` · Product: ${thread.product.title}` : ""}
                </p>
                {latest ? (
                  <p className="subtle mt-1 line-clamp-1 text-[12.5px]">{latest.body}</p>
                ) : null}
              </Link>
            );
          })}
        </Card>
      ) : null}
    </div>
  );
}
