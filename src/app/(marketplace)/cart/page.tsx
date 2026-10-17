import Link from "next/link";
import { ImageIcon, ShoppingCart } from "lucide-react";

import { CheckoutButton, RemoveFromCartButton } from "@/components/marketplace/cart-actions";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isStripeConfigured } from "@/lib/env";
import { removeFromCartAction } from "@/lib/marketplace/actions";
import { formatMoney } from "@/lib/money";
import { startCheckoutAction } from "@/lib/payments/actions";
import { previewCart } from "@/lib/payments/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cart" };

export default async function CartPage() {
  const user = await requireUser("/cart");

  const items = await prisma.cartItem.findMany({
    where: { cart: { userId: user.id } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailUrl: true,
          priceMinor: true,
          salePriceMinor: true,
          currency: true,
          status: true,
          seller: { select: { slug: true, storeName: true } },
        },
      },
    },
  });

  // The authoritative, database-derived price list for this cart.
  const preview = await previewCart(user.id);
  const chargedPrice = new Map(preview.lines.map((line) => [line.productId, line.unitPriceMinor]));

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <h1 className="text-[18px] font-semibold tracking-tight">Your cart</h1>
        <Card className="mt-4">
          <EmptyState
            icon={<ShoppingCart className="size-5" aria-hidden />}
            title="Your cart is empty"
            description="Every product you add stays here until you check out. Nothing is charged until you confirm payment."
            action={
              <Link href="/browse" className={buttonClass("primary")}>
                Browse products
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <header className="mb-4">
        <h1 className="text-[18px] font-semibold tracking-tight">Your cart</h1>
        <p className="muted mt-1 text-[12.5px]">
          {items.length} {items.length === 1 ? "item" : "items"} · digital delivery, no shipping
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <ul className="divide-y divide-line">
            {items.map((item: any) => {
              const product = item.product;
              const price = chargedPrice.get(product.id) ?? product.salePriceMinor ?? product.priceMinor;
              const original = product.salePriceMinor ?? product.priceMinor;
              const available = product.status === "PUBLISHED" && chargedPrice.has(product.id);

              return (
                <li key={item.id} className="flex gap-3 p-3.5">
                  <Link
                    href={`/product/${product.slug}`}
                    className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-line bg-elevated"
                  >
                    {product.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote hosts are declared in next.config.ts
                      <img
                        src={product.thumbnailUrl}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon className="size-5 text-ink-subtle" aria-hidden />
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/product/${product.slug}`}
                          className="block truncate text-[13.5px] font-medium text-ink hover:text-accent"
                        >
                          {product.title}
                        </Link>
                        <p className="muted mt-0.5 truncate text-[12px]">
                          by{" "}
                          <Link
                            href={`/seller/${product.seller.slug}`}
                            className="hover:text-ink"
                          >
                            {product.seller.storeName}
                          </Link>
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[13.5px] font-semibold tabular-nums">
                          {formatMoney(price, product.currency)}
                        </p>
                        {price < original ? (
                          <p className="subtle text-[11.5px] line-through tabular-nums">
                            {formatMoney(original, product.currency)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {available ? (
                        <Badge tone="accent">Instant download</Badge>
                      ) : (
                        <StatusBadge status={product.status} />
                      )}
                      <div className="ml-auto">
                        <RemoveFromCartButton action={removeFromCartAction} itemId={item.id} />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-3 lg:sticky lg:top-20">
          {preview.issues.length > 0 ? (
            <Alert tone="warning" title="Some items were removed">
              <ul className="list-disc space-y-0.5 pl-4">
                {preview.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <Card>
            <CardHeader title="Order summary" />
            <CardBody className="space-y-3">
              <dl className="space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-muted">
                    Subtotal ({preview.lines.length}{" "}
                    {preview.lines.length === 1 ? "item" : "items"})
                  </dt>
                  <dd className="tabular-nums">{formatMoney(preview.subtotalMinor, preview.currency)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-2 text-[14px] font-semibold">
                  <dt>Total due today</dt>
                  <dd className="tabular-nums">{formatMoney(preview.subtotalMinor, preview.currency)}</dd>
                </div>
              </dl>

              <p className="subtle text-[11.5px] leading-relaxed">
                The marketplace commission is deducted from the seller&apos;s payout, so the price
                above is exactly what you pay. Payment is processed by Stripe; card details never
                reach our servers.
              </p>

              {isStripeConfigured ? null : (
                <Alert tone="warning" title="Payments are not configured">
                  Stripe Connect credentials are missing on this deployment. Checkout is disabled and
                  no order can be placed.
                </Alert>
              )}

              <CheckoutButton
                action={startCheckoutAction}
                disabled={preview.lines.length === 0 || !isStripeConfigured}
              />

              <Link
                href="/browse"
                className="block text-center text-[12px] text-ink-muted hover:text-ink"
              >
                Continue shopping
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
