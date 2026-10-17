import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NewTicketForm } from "@/components/support/ticket-forms";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { createTicketAction } from "@/lib/support/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact support" };

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const user = await requireUser("/support/new");
  const { order } = await searchParams;

  const orders = await prisma.order.findMany({
    where: { buyerId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, orderNumber: true, totalMinor: true, currency: true, createdAt: true },
  });

  const options = orders.map((entry) => ({
    id: entry.id,
    label: `${entry.orderNumber} · ${entry.createdAt.toISOString().slice(0, 10)} · ${formatMoney(
      entry.totalMinor,
      entry.currency,
    )}`,
  }));

  const defaultOrderId = order ? orders.find((entry) => entry.orderNumber === order)?.id : undefined;

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6">
      <Link
        href="/support"
        className="subtle mb-4 inline-flex items-center gap-1.5 text-[12px] hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Help centre
      </Link>

      <Card>
        <CardHeader
          title="Open a support ticket"
          description="Describe the problem and staff will reply in the ticket thread. Replies appear on this page."
        />
        <CardBody>
          <NewTicketForm
            action={createTicketAction}
            orders={options}
            defaultOrderId={defaultOrderId}
          />
        </CardBody>
      </Card>
    </div>
  );
}
