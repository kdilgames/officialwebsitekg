import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout canceled" };

/** Stripe sends the buyer here when they abandon the payment page. */
export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const user = await requireUser("/cart");
  const { order: orderId } = await searchParams;

  // Scoped to the signed-in buyer so an arbitrary id cannot leak another order.
  const order = orderId
    ? await prisma.order.findFirst({
        where: { id: orderId, buyerId: user.id },
        select: {
          orderNumber: true,
          status: true,
          totalMinor: true,
          currency: true,
          items: { select: { id: true, titleSnapshot: true } },
        },
      })
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-[18px] font-semibold tracking-tight">Checkout canceled</h1>

      <Alert tone="info" title="Nothing was charged">
        The payment was not completed, so no money left your account and no products were unlocked.
        Your cart is exactly as you left it.
      </Alert>

      {order ? (
        <Card className="mt-3">
          <CardHeader
            title={`Order ${order.orderNumber}`}
            description={`${order.items.length} ${order.items.length === 1 ? "item" : "items"} · ${formatMoney(order.totalMinor, order.currency)}`}
            actions={<StatusBadge status={order.status} />}
          />
          <CardBody className="space-y-3">
            <ul className="space-y-1 text-[12.5px] text-ink-muted">
              {order.items.map((item: any) => (
                <li key={item.id} className="truncate">
                  {item.titleSnapshot}
                </li>
              ))}
            </ul>
            <p className="subtle text-[11.5px]">
              This order stays in your history as unpaid. You can start a new checkout from the cart
              whenever you are ready — prices and commissions are recalculated at that moment.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/cart" className={buttonClass("primary")}>
          <ShoppingCart className="size-4" aria-hidden />
          Back to cart
        </Link>
        <Link href="/browse" className={buttonClass("secondary")}>
          Keep browsing
        </Link>
        <Link href="/support" className={buttonClass("ghost")}>
          Need help?
        </Link>
      </div>
    </div>
  );
}
