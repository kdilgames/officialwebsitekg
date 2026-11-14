import { Tag } from "lucide-react";

import { ActionButton } from "@/components/admin/action-forms";
import { CouponCreatorForm } from "@/components/forms/promo-forms";
import { EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireSeller } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import {
  createSellerCouponAction,
  deleteSellerCouponAction,
  toggleSellerCouponAction,
} from "@/lib/seller/actions";
import { listSellerCoupons } from "@/lib/seller/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Coupons · Seller dashboard" };

export default async function SellerCouponsPage() {
  const user = await requireSeller();
  const coupons = await listSellerCoupons(user.sellerProfile.id);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Promo codes</h1>
        <p className="muted mt-1 text-[12.5px]">
          Create percentage or fixed-amount promo codes for your store. Discounts apply to matching
          products and bundles in the buyer&apos;s cart.
        </p>
      </header>

      <Card>
        <CardHeader title="Create a store promo code" />
        <CardBody>
          <CouponCreatorForm
            action={createSellerCouponAction}
            scopeHint="Store promo codes apply exclusively to your listings and bundles."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`${coupons.length} promo code${coupons.length === 1 ? "" : "s"}`}
          description="Pause or delete a code at any time without affecting completed orders."
        />
        {coupons.length === 0 ? (
          <EmptyState
            icon={<Tag className="size-5" aria-hidden />}
            title="No promo codes yet"
            description="Create a launch code above to reward early supporters or run seasonal sales."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min subtotal</th>
                  <th>Redemptions</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => {
                  const discountLabel =
                    coupon.discountType === "PERCENT"
                      ? `${coupon.percentOff ?? 0}% off`
                      : `${formatMoney(coupon.amountOffMinor ?? 0, coupon.currency)} off`;
                  const isExpired = coupon.expiresAt ? coupon.expiresAt <= new Date() : false;

                  return (
                    <tr key={coupon.id}>
                      <td className="font-mono text-[13px] font-semibold text-ink">
                        {coupon.code}
                      </td>
                      <td className="whitespace-nowrap">{discountLabel}</td>
                      <td className="whitespace-nowrap tabular-nums text-ink-muted">
                        {coupon.minSubtotalMinor !== null
                          ? formatMoney(coupon.minSubtotalMinor, coupon.currency)
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap tabular-nums">
                        {coupon.redemptionCount}
                        {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : " / ∞"}
                      </td>
                      <td className="whitespace-nowrap text-[12px] text-ink-muted">
                        {coupon.expiresAt ? coupon.expiresAt.toISOString().slice(0, 10) : "Never"}
                      </td>
                      <td>
                        {isExpired ? (
                          <Badge tone="caution">expired</Badge>
                        ) : coupon.isActive ? (
                          <Badge tone="positive">active</Badge>
                        ) : (
                          <Badge tone="caution">paused</Badge>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <ActionButton
                            action={toggleSellerCouponAction}
                            fields={{ couponId: coupon.id }}
                            variant="secondary"
                          >
                            {coupon.isActive ? "Pause" : "Activate"}
                          </ActionButton>
                          <ActionButton
                            action={deleteSellerCouponAction}
                            fields={{ couponId: coupon.id }}
                            variant="danger"
                            confirm={`Delete promo code “${coupon.code}”?`}
                          >
                            Delete
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
