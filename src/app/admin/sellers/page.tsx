import Link from "next/link";
import { Store } from "lucide-react";

import { SellerDecisionForm } from "@/components/admin/admin-forms";
import { ActionButton, ReasonForm } from "@/components/admin/action-forms";
import { EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/table";
import {
  approveSellerAction,
  rejectSellerAction,
  reinstateSellerAction,
  suspendSellerAction,
} from "@/lib/admin/actions";
import { ADMIN_PAGE_SIZE, listSellerApplications } from "@/lib/admin/queries";
import { formatBps } from "@/lib/commission";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sellers · Admin" };

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "ALL", label: "All" },
];

export default async function AdminSellersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "PENDING";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const result = await listSellerApplications({ status, page });

  const buildHref = (next: number) => {
    const query = new URLSearchParams();
    if (status !== "PENDING") query.set("status", status);
    if (next > 1) query.set("page", String(next));
    const suffix = query.toString();
    return suffix ? `/admin/sellers?${suffix}` : "/admin/sellers";
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Seller applications</h1>
          <p className="muted mt-1 text-[12.5px]">
            Applications, approvals and suspensions. A seller can never approve their own store, and
            approving sets the account role to seller.
          </p>
        </div>

        <form action="/admin/sellers" className="flex items-center gap-2">
          <label className="label mb-0" htmlFor="status">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status} className="h-8 w-[150px]">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <button type="submit" className="btn btn-secondary btn-sm">
            Filter
          </button>
        </form>
      </header>

      <Card>
        <CardHeader
          title={`${result.total} application${result.total === 1 ? "" : "s"}`}
          description={`Showing page ${result.page} of ${result.totalPages} · ${ADMIN_PAGE_SIZE} per page`}
        />

        {result.items.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description="No seller applications match this filter."
            icon={<Store className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-line">
            {result.items.map((seller) => (
              <li key={seller.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/seller/${seller.slug}`}
                        className="truncate text-[13.5px] font-medium hover:text-accent"
                      >
                        {seller.storeName}
                      </Link>
                      <StatusBadge status={seller.status} />
                      {seller.commissionBps !== null ? (
                        <Badge tone="accent">{formatBps(seller.commissionBps)}</Badge>
                      ) : (
                        <Badge>
                          default {(env.marketplace.defaultCommissionBps / 100).toFixed(2)}%
                        </Badge>
                      )}
                    </div>
                    <p className="muted mt-1 text-[12px]">
                      {seller.user.displayName} (@{seller.user.username}) · {seller.user.email} ·{" "}
                      {seller.user.status.toLowerCase()}
                    </p>
                    <p className="subtle mt-0.5 text-[11.5px]">
                      Applied {seller.createdAt.toISOString().slice(0, 10)} ·{" "}
                      {seller._count.products} product{seller._count.products === 1 ? "" : "s"}
                      {seller.country ? ` · ${seller.country}` : ""}
                      {seller.supportEmail ? ` · ${seller.supportEmail}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-right text-[11.5px]">
                    <span className={seller.stripeChargesEnabled ? "text-positive" : "subtle"}>
                      Charges {seller.stripeChargesEnabled ? "enabled" : "not enabled"}
                    </span>
                    <span className={seller.stripePayoutsEnabled ? "text-positive" : "subtle"}>
                      Payouts {seller.stripePayoutsEnabled ? "enabled" : "not enabled"}
                    </span>
                  </div>
                </div>

                {seller.tagline ? (
                  <p className="text-[12.5px] text-ink-muted">{seller.tagline}</p>
                ) : null}

                {seller.applicationNote ? (
                  <div className="surface-elevated p-2.5">
                    <p className="subtle text-[11px] font-medium uppercase tracking-[0.04em]">
                      Applicant&apos;s note
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[12.5px]">
                      {seller.applicationNote}
                    </p>
                  </div>
                ) : null}

                {seller.reviewNote ? (
                  <div className="surface-elevated p-2.5">
                    <p className="subtle text-[11px] font-medium uppercase tracking-[0.04em]">
                      Last staff note
                      {seller.reviewedAt
                        ? ` · ${seller.reviewedAt.toISOString().slice(0, 10)}`
                        : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[12.5px]">{seller.reviewNote}</p>
                  </div>
                ) : null}

                {seller.about ? (
                  <details>
                    <summary className="cursor-pointer text-[12px] text-ink-muted hover:text-ink">
                      Read the full application
                    </summary>
                    <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] text-ink-muted">
                      {seller.about}
                    </p>
                  </details>
                ) : null}

                <div className="flex flex-wrap items-start gap-2">
                  {seller.status === "PENDING" ? (
                    <>
                      <div className="w-full max-w-sm">
                        <SellerDecisionForm action={approveSellerAction} sellerId={seller.id} />
                      </div>
                      <ReasonForm
                        action={rejectSellerAction}
                        fields={{ sellerId: seller.id }}
                        label="Reject application"
                        submitLabel="Reject application"
                        placeholder="Explain what the applicant should change before applying again."
                        confirm="Reject this application?"
                      />
                    </>
                  ) : null}

                  {seller.status === "APPROVED" ? (
                    <ReasonForm
                      action={suspendSellerAction}
                      fields={{ sellerId: seller.id }}
                      label="Suspend store"
                      submitLabel="Suspend store"
                      placeholder="Why is this store being suspended? Published listings are removed from the storefront."
                      confirm="Suspend this store and remove its published listings?"
                    />
                  ) : null}

                  {seller.status === "SUSPENDED" ? (
                    <ActionButton
                      action={reinstateSellerAction}
                      fields={{ sellerId: seller.id }}
                      variant="primary"
                    >
                      Reinstate store
                    </ActionButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
    </div>
  );
}
