import Link from "next/link";
import { Tag } from "lucide-react";

import { ActionButton } from "@/components/admin/action-forms";
import { CouponCreatorForm } from "@/components/forms/promo-forms";
import { EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  createAdminCouponAction,
  deleteAdminCouponAction,
  toggleAdminCouponAction,
} from "@/lib/admin/actions";
import { listAdminCoupons } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Coupons · Admin" };

export default async function AdminCouponsPage() {
  const coupons = await listAdminCoupons();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Promo codes</h1>
        <p className="muted mt-1 text-[12.5px]">
          Create platform-wide promo codes that work on every eligible cart, or review and pause
          seller-scoped codes below.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Create platform promo code"
          description="Platform-wide codes reduce item prices across all stores at checkout."
        />
        <CardBody>
          <CouponCreatorForm
            action={createAdminCouponAction}
            submitLabel="Create platform promo"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`${coupons.length} promo code${coupons.length === 1 ? "" : "s"}`}
          description="Includes both platform-wide campaigns and individual creator store codes."
        />
        {coupons.length === 0 ? (
          <EmptyState
            icon={<Tag className="size-5" aria-hidden />}
            title="No promo codes created"
            description="Create a platform campaign code above or allow creators to add store codes."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Scope</th>
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
                      <td>
                        {coupon.seller ? (
                          <Link
                            href={`/seller/${coupon.seller.slug}`}
                            className="text-[12.5px] text-ink-muted hover:text-ink hover:underline"
                          >
                            {coupon.seller.storeName}
                          </Link>
                        ) : (
                          <Badge tone="accent">platform</Badge>
                        )}
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
                            action={toggleAdminCouponAction}
                            fields={{ couponId: coupon.id }}
                            variant="secondary"
                          >
                            {coupon.isActive ? "Pause" : "Activate"}
                          </ActionButton>
                          <ActionButton
                            action={deleteAdminCouponAction}
                            fields={{ couponId: coupon.id }}
                            variant="danger"
                            confirm={`Permanently delete promo code “${coupon.code}”?`}
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
