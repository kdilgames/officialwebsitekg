import Link from "next/link";
import { Clock, Download, ShieldCheck } from "lucide-react";

import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { reconcileCheckoutSession } from "@/lib/payments/stripe-events";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order confirmation" };

const SETTLED = new Set(["PAID", "PARTIALLY_REFUNDED"]);

/**
 * Stripe sends the buyer back here with the Checkout Session id.
 *
 * The id alone proves nothing, so the payment state is read from Stripe on the
 * server and applied through the same idempotent path the webhook uses. This
 * only covers the window before the webhook arrives; it never trusts the query
 * string for the amount or the status.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const user = await requireUser("/account/orders");
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    return (
      <Shell>
        <Card>
          <EmptyState
            title="We could not identify that checkout"
            description="The confirmation link is incomplete. Your order history always shows the real payment state."
            action={
              <Link href="/account/orders" className={buttonClass("primary")}>
                Open orders &amp; downloads
              </Link>
            }
          />
        </Card>
      </Shell>
    );
  }

  let order = await loadOrder(sessionId, user.id);

  if (!order) {
    return (
      <Shell>
        <Card>
          <EmptyState
            title="Order not found"
            description="This checkout does not belong to your account. If you were charged, contact support with your receipt."
            action={
              <Link href="/support" className={buttonClass("secondary")}>
                Contact support
              </Link>
            }
          />
        </Card>
      </Shell>
    );
  }

  let reconciled = false;
  if (!SETTLED.has(order.status)) {
    const stripe = getStripe();
    if (stripe) {
      try {
        const outcome = await reconcileCheckoutSession(stripe, {
          sessionId,
          buyerId: user.id,
        });
        if (outcome.status === "PROCESSED") {
          const refreshed = await loadOrder(sessionId, user.id);
          if (refreshed) order = refreshed;
          reconciled = true;
        }
      } catch {
        // A reconciliation failure is not fatal: the webhook is the source of truth.
      }
    }
  }

  const settled = SETTLED.has(order.status);

  return (
    <Shell>
      <div className="space-y-3">
        {settled ? (
          <Alert tone="success" title="Payment confirmed">
            Your order is complete. Download links are available in orders &amp; downloads and stay
            available for as long as the seller keeps the product published.
          </Alert>
        ) : reconciled ? (
          <Alert tone="info" title="Payment is being confirmed">
            Stripe accepted the payment and the order is settling. This normally takes a few seconds.
          </Alert>
        ) : (
          <Alert tone="warning" title="Waiting for payment confirmation">
            Stripe has not confirmed this payment yet, so nothing has been unlocked. This page reads
            the state directly from Stripe — refresh to check again.
          </Alert>
        )}

        <Card>
          <CardHeader
            title={`Order ${order.orderNumber}`}
            description={
              order.paidAt
                ? `Paid ${order.paidAt.toISOString().slice(0, 16).replace("T", " ")} UTC`
                : "Awaiting payment"
            }
            actions={
              <div className="flex items-center gap-1.5">
                {order.isTestMode ? <Badge tone="caution">Test mode</Badge> : null}
                <StatusBadge status={order.status} />
              </div>
            }
          />
          <ul className="divide-y divide-line">
            {order.items.map((item: any) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <Link
                  href={`/product/${item.product.slug}`}
                  className="truncate text-[13px] text-ink hover:text-accent"
                >
                  {item.titleSnapshot}
                </Link>
                <span className="shrink-0 text-[13px] tabular-nums">
                  {formatMoney(item.priceMinor, order.currency)}
                </span>
              </li>
            ))}
          </ul>
          <CardBody className="space-y-3 border-t border-line">
            <div className="flex items-center justify-between text-[14px] font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(order.totalMinor, order.currency)}</span>
            </div>

            {order.isTestMode ? (
              <p className="subtle text-[11.5px]">
                This order was processed with Stripe test keys. No real money moved and the download
                entitlement is real only in the test environment.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/account/orders"
                className={buttonClass(settled ? "primary" : "secondary")}
              >
                <Download className="size-4" aria-hidden />
                Orders &amp; downloads
              </Link>
              <a
                href={`/checkout/success?session_id=${encodeURIComponent(sessionId)}`}
                className={buttonClass("ghost")}
              >
                <Clock className="size-4" aria-hidden />
                Refresh status
              </a>
            </div>
          </CardBody>
        </Card>

        <p className="subtle flex items-center gap-1.5 text-[11.5px]">
          <ShieldCheck className="size-3.5 text-ink-subtle" aria-hidden />
          Card details are handled entirely by Stripe and never reach this application.
        </p>
      </div>
    </Shell>
  );
}

async function loadOrder(sessionId: string, buyerId: string) {
  return prisma.order.findFirst({
    where: { stripeCheckoutSessionId: sessionId, buyerId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalMinor: true,
      currency: true,
      paidAt: true,
      isTestMode: true,
      items: {
        select: {
          id: true,
          titleSnapshot: true,
          priceMinor: true,
          product: { select: { slug: true } },
        },
      },
    },
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-[18px] font-semibold tracking-tight">Checkout</h1>
      {children}
    </div>
  );
}
