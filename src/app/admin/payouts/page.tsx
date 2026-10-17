import Link from "next/link";
import { Wallet } from "lucide-react";

import { StateActionButton, StateForm } from "@/components/admin/action-forms";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/form";
import { Pagination } from "@/components/ui/table";
import { cancelPayoutAction, executePayoutAction } from "@/lib/admin/actions";
import { listPayouts } from "@/lib/admin/queries";
import { isStripeConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payouts · Admin" };

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_TRANSIT", label: "In transit" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELED", label: "Canceled" },
  { value: "ALL", label: "All" },
];

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "PENDING";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const result = await listPayouts({ status, page });

  const buildHref = (next: number) => {
    const query = new URLSearchParams();
    if (status !== "PENDING") query.set("status", status);
    if (next > 1) query.set("page", String(next));
    const suffix = query.toString();
    return suffix ? `/admin/payouts?${suffix}` : "/admin/payouts";
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Payouts</h1>
          <p className="muted mt-1 text-[12.5px]">
            A seller requests a payout, which reserves the earnings it covers. Releasing it sends a
            transfer to the seller&apos;s connected account and the payable total is recomputed from
            the attached earnings at that moment.
          </p>
        </div>

        <form action="/admin/payouts" className="flex items-center gap-2">
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

      {!isStripeConfigured ? (
        <Alert tone="warning" title="Stripe is not configured">
          A transfer cannot be created until <code>STRIPE_SECRET_KEY</code> is set. The balance is
          left reserved and the attempt returns an explicit error.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title={`${result.total} payout${result.total === 1 ? "" : "s"}`}
          description={`Showing page ${result.page} of ${result.totalPages}`}
        />

        {result.items.length === 0 ? (
          <EmptyState
            title="No payouts"
            description="No payout requests match this filter."
            icon={<Wallet className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-line">
            {result.items.map((payout) => (
              <li key={payout.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold tabular-nums">
                        {formatMoney(payout.amountMinor, payout.currency)}
                      </span>
                      <StatusBadge status={payout.status} />
                      <Badge>{payout.method.toLowerCase()}</Badge>
                      {payout.seller.stripePayoutsEnabled ? (
                        <Badge tone="positive">payouts enabled</Badge>
                      ) : (
                        <Badge tone="critical">payouts disabled</Badge>
                      )}
                    </div>

                    <p className="muted mt-1 text-[12.5px]">
                      <Link href={`/seller/${payout.seller.slug}`} className="hover:text-accent">
                        {payout.seller.storeName}
                      </Link>{" "}
                      · {payout._count.earnings} earning
                      {payout._count.earnings === 1 ? "" : "s"} attached
                      {payout.initiator
                        ? ` · requested by ${payout.initiator.displayName}`
                        : ""}
                    </p>

                    <p className="subtle mt-0.5 text-[11.5px]">
                      Created {payout.createdAt.toISOString().slice(0, 10)}
                      {payout.processedAt
                        ? ` · settled ${payout.processedAt.toISOString().slice(0, 10)}`
                        : ""}
                      {payout.seller.stripeAccountId
                        ? ` · ${payout.seller.stripeAccountId}`
                        : " · no connected account"}
                    </p>

                    {payout.stripeTransferId ? (
                      <p className="subtle mt-1 break-all font-mono text-[10.5px]">
                        transfer {payout.stripeTransferId}
                      </p>
                    ) : null}

                    {payout.failureReason ? (
                      <p className="mt-1 text-[12px] text-critical">{payout.failureReason}</p>
                    ) : null}
                  </div>
                </div>

                {payout.status === "PENDING" ? (
                  <div className="flex w-full max-w-md flex-col gap-3">
                    <StateActionButton
                      action={executePayoutAction}
                      fields={{ payoutId: payout.id }}
                      variant="primary"
                      pendingLabel="Contacting provider…"
                      confirm={`Transfer ${formatMoney(payout.amountMinor, payout.currency)} to ${payout.seller.storeName}?`}
                    >
                      Release transfer
                    </StateActionButton>

                    <StateForm
                      action={cancelPayoutAction}
                      fields={{ payoutId: payout.id }}
                      submitLabel="Cancel payout"
                      pendingLabel="Canceling…"
                      variant="danger"
                      className="surface-elevated p-2.5"
                    >
                      <label className="label mb-0" htmlFor={`cancel-${payout.id}`}>
                        Why is this payout being canceled?
                      </label>
                      <Textarea
                        id={`cancel-${payout.id}`}
                        name="reason"
                        rows={2}
                        maxLength={2000}
                        placeholder="The seller is told this reason. The balance becomes available again."
                      />
                    </StateForm>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
    </div>
  );
}
