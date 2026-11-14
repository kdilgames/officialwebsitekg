import Link from "next/link";
import { ImageIcon, Layers, ShoppingCart } from "lucide-react";

import {
  CheckoutButton,
  CouponForm,
  RemoveBundleFromCartButton,
  RemoveFromCartButton,
} from "@/components/marketplace/cart-actions";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { env, isStripeConfigured } from "@/lib/env";
import {
  applyCouponAction,
  removeBundleFromCartAction,
  removeCouponAction,
  removeFromCartAction,
} from "@/lib/marketplace/actions";
import { formatMoney } from "@/lib/money";
import { startCheckoutAction } from "@/lib/payments/actions";
import { previewCart } from "@/lib/payments/orders";
import { STRIPE_MIN_CHARGE_MINOR } from "@/lib/payments/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cart" };

export default async function CartPage() {
  const user = await requireUser("/cart");

  const [bundleEntries, items] = await Promise.all([
    withSchemaFallback(
      () =>
        prisma.cartBundle.findMany({
          where: { cart: { userId: user.id } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            bundle: {
              select: {
                id: true,
                title: true,
                slug: true,
                bundlePriceMinor: true,
                currency: true,
                isActive: true,
                seller: { select: { slug: true, storeName: true } },
                items: {
                  orderBy: { sortOrder: "asc" },
                  select: {
                    product: {
                      select: {
                        id: true,
                        title: true,
                        slug: true,
                        priceMinor: true,
                        salePriceMinor: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      [],
    ),
    prisma.cartItem.findMany({
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
    }),
  ]);

  // The authoritative, database-derived price list for this cart.
  const preview = await previewCart(user.id);
  const previewByProductId = new Map(preview.lines.map((line) => [line.productId, line]));

  if (items.length === 0 && bundleEntries.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <h1 className="text-[24px] font-bold tracking-tight">Your cart</h1>
        <Card className="mt-4">
          <EmptyState
            icon={<ShoppingCart className="size-5" aria-hidden />}
            title="Your cart is empty"
            description="Every product or bundle you add stays here until you check out. Nothing is charged until you confirm payment."
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

  const belowMinimumPaidTotal =
    preview.totalMinor > 0 && preview.totalMinor < STRIPE_MIN_CHARGE_MINOR;
  const requiresStripe = preview.totalMinor > 0;
  const isFreeCheckout = preview.lines.length > 0 && preview.totalMinor === 0;
  const entryCount = bundleEntries.length + items.length;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h1 className="text-[24px] font-bold tracking-tight">Your cart</h1>
        <p className="muted mt-1 text-[13.5px]">
          {entryCount} {entryCount === 1 ? "entry" : "entries"} · {preview.lines.length}{" "}
          {preview.lines.length === 1 ? "downloadable product" : "downloadable products"} · instant
          digital delivery
        </p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {bundleEntries.length > 0 ? (
            <Card>
              <CardHeader
                title="Bundles"
                description="Bundle pricing overrides matching individual items."
              />
              <ul className="divide-y divide-line">
                {bundleEntries.map((entry) => {
                  const { bundle } = entry;
                  const regularSum = bundle.items.reduce(
                    (sum, item) => sum + (item.product.salePriceMinor ?? item.product.priceMinor),
                    0,
                  );

                  return (
                    <li key={entry.id} className="space-y-2.5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="accent">
                              <Layers className="size-3" aria-hidden />
                              Bundle
                            </Badge>
                            <Link
                              href={`/bundle/${bundle.slug}`}
                              className="truncate text-[14px] font-semibold text-ink hover:text-accent"
                            >
                              {bundle.title}
                            </Link>
                          </div>
                          <p className="muted mt-0.5 text-[12px]">
                            by{" "}
                            <Link href={`/seller/${bundle.seller.slug}`} className="hover:text-ink">
                              {bundle.seller.storeName}
                            </Link>{" "}
                            · {bundle.items.length} products
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[14px] font-semibold tabular-nums text-ink">
                            {bundle.bundlePriceMinor === 0
                              ? "Free"
                              : formatMoney(bundle.bundlePriceMinor, bundle.currency)}
                          </p>
                          {regularSum > bundle.bundlePriceMinor ? (
                            <p className="subtle text-[11.5px] line-through tabular-nums">
                              {formatMoney(regularSum, bundle.currency)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {bundle.items.map(({ product }) => (
                          <Link
                            key={product.id}
                            href={`/product/${product.slug}`}
                            className="badge hover:border-line-strong hover:text-ink"
                          >
                            {product.title}
                          </Link>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-0.5">
                        {bundle.isActive ? (
                          <Badge tone="positive">Included at bundle rate</Badge>
                        ) : (
                          <Badge tone="caution">Unavailable</Badge>
                        )}
                        <RemoveBundleFromCartButton
                          action={removeBundleFromCartAction}
                          bundleEntryId={entry.id}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          {items.length > 0 ? (
            <Card>
              <ul className="divide-y divide-line">
                {items.map((item) => {
                  const product = item.product;
                  const line = previewByProductId.get(product.id);
                  const original = product.salePriceMinor ?? product.priceMinor;
                  const displayPrice = line?.originalUnitPriceMinor ?? original;
                  const available = product.status === "PUBLISHED" && Boolean(line);

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
                              {displayPrice === 0 ? (
                                <span className="text-positive">Free</span>
                              ) : (
                                formatMoney(displayPrice, product.currency)
                              )}
                            </p>
                            {displayPrice < product.priceMinor && product.priceMinor > 0 ? (
                              <p className="subtle text-[11.5px] line-through tabular-nums">
                                {formatMoney(product.priceMinor, product.currency)}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {line?.bundleTitle ? (
                            <Badge tone="accent">Covered by {line.bundleTitle}</Badge>
                          ) : available ? (
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
          ) : null}
        </div>

        <div className="space-y-3 lg:sticky lg:top-20">
          {preview.issues.length > 0 ? (
            <Alert tone="warning" title="Cart notice">
              <ul className="list-disc space-y-0.5 pl-4">
                {preview.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <Card>
            <CardHeader title="Order summary" />
            <CardBody className="space-y-3.5">
              <dl className="space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-muted">
                    Subtotal ({preview.lines.length}{" "}
                    {preview.lines.length === 1 ? "item" : "items"})
                  </dt>
                  <dd className="tabular-nums">
                    {formatMoney(preview.subtotalMinor, preview.currency)}
                  </dd>
                </div>

                {preview.discountMinor > 0 && preview.coupon ? (
                  <div className="flex items-center justify-between text-positive">
                    <dt>Discount ({preview.coupon.code})</dt>
                    <dd className="tabular-nums">
                      -{formatMoney(preview.discountMinor, preview.currency)}
                    </dd>
                  </div>
                ) : null}

                <div className="flex items-center justify-between border-t border-line pt-2 text-[14px] font-semibold">
                  <dt>Total due today</dt>
                  <dd className="tabular-nums">
                    {preview.totalMinor === 0 ? (
                      <span className="text-positive">Free</span>
                    ) : (
                      formatMoney(preview.totalMinor, preview.currency)
                    )}
                  </dd>
                </div>
              </dl>

              <CouponForm
                action={applyCouponAction}
                removeAction={removeCouponAction}
                appliedCode={preview.coupon?.code ?? null}
                couponError={preview.couponError}
              />

              <p className="subtle text-[11.5px] leading-relaxed">
                {isFreeCheckout
                  ? "This order totals €0 and unlocks straight into your library without card details."
                  : env.stripe.automaticTax
                    ? "Applicable EU VAT or local tax is calculated automatically at Stripe Checkout based on your billing address. Card details never reach our servers."
                    : "The marketplace commission is deducted from the seller's payout, so the price above is what you pay before any applicable taxes. Payment is processed securely by Stripe."}
              </p>

              {belowMinimumPaidTotal ? (
                <Alert tone="warning" title="Minimum charge required">
                  Paid checkouts processed through Stripe must total at least{" "}
                  {formatMoney(STRIPE_MIN_CHARGE_MINOR, preview.currency)}. Remove the promo code or
                  add another product to check out.
                </Alert>
              ) : null}

              {requiresStripe && !isStripeConfigured ? (
                <Alert tone="warning" title="Payments are not configured">
                  Stripe Connect credentials are missing on this deployment. Paid checkouts are
                  disabled until Stripe is configured.
                </Alert>
              ) : null}

              <CheckoutButton
                action={startCheckoutAction}
                isFree={isFreeCheckout}
                disabled={
                  preview.lines.length === 0 ||
                  belowMinimumPaidTotal ||
                  (requiresStripe && !isStripeConfigured)
                }
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
