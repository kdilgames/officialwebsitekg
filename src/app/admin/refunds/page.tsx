import Link from "next/link";
import { CreditCard } from "lucide-react";

import { RefundDecisionForm } from "@/components/admin/admin-forms";
import { StateActionButton, StateForm } from "@/components/admin/action-forms";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/form";
import { Pagination } from "@/components/ui/table";
import {
  decideRefundAction,
  executeRefundAction,
  failRefundAction,
} from "@/lib/admin/actions";
import { listRefunds } from "@/lib/admin/queries";
import { isStripeConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Refunds · Admin" };

const STATUS_OPTIONS = [
  { value: "REQUESTED", label: "Requested" },
  { value: "APPROVED", label: "Approved" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PROCESSED", label: "Processed" },
  { value: "REJECTED", label: "Declined" },
  { value: "FAILED", label: "Failed" },
  { value: "ALL", label: "All" },
];

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "REQUESTED";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const result = await listRefunds({ status, page });

  const buildHref = (next: number) => {
    const query = new URLSearchParams();
    if (status !== "REQUESTED") query.set("status", status);
    if (next > 1) query.set("page", String(next));
    const suffix = query.toString();
    return suffix ? `/admin/refunds?${suffix}` : "/admin/refunds";
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Refunds</h1>
          <p className="muted mt-1 text-[12.5px]">
            Deciding a request moves no money. A refund only leaves the platform when it is sent to
            the payment provider, and it stays open until the provider confirms it.
          </p>
        </div>

        <form action="/admin/refunds" className="flex items-center gap-2">
          <label className="label mb-0" htmlFor="status">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status} className="h-8 w-[160px]">
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
          Refunds cannot be sent to the provider until <code>STRIPE_SECRET_KEY</code> is set. The
          attempt fails with an explicit error rather than being simulated.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title={`${result.total} refund${result.total === 1 ? "" : "s"}`}
          description={`Showing page ${result.page} of ${result.totalPages}`}
        />

        {result.items.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description="No refund requests match this filter."
            icon={<CreditCard className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-line">
            {result.items.map((refund: any) => (
              <li key={refund.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold tabular-nums">
                        {formatMoney(refund.amountMinor, refund.currency)}
                      </span>
                      <StatusBadge status={refund.status} />
                      {refund.requestedBy ? (
                        <Badge>
                          by @{refund.requestedBy.username}
                          {refund.requestedBy.email ? ` · ${refund.requestedBy.email}` : ""}
                        </Badge>
                      ) : (
                        <Badge tone="accent">initiated by staff</Badge>
                      )}
                    </div>

                    <p className="muted mt-1 text-[12.5px]">
                      Reason: {refund.reason}
                      {refund.orderItem ? ` · line “${refund.orderItem.titleSnapshot}”` : " · whole order"}
                    </p>

                    <p className="subtle mt-0.5 text-[11.5px]">
                      <Link
                        href={`/admin/orders?q=${encodeURIComponent(refund.order.orderNumber)}`}
                        className="font-mono hover:text-ink"
                      >
                        {refund.order.orderNumber}
                      </Link>{" "}
                      · order total {formatMoney(refund.order.totalMinor, refund.order.currency)} ·{" "}
                      {refund.order.status.replaceAll("_", " ").toLowerCase()} · requested{" "}
                      {refund.createdAt.toISOString().slice(0, 10)}
                      {refund.processedAt
                        ? ` · closed ${refund.processedAt.toISOString().slice(0, 10)}`
                        : ""}
                    </p>

                    {refund.buyerNote ? (
                      <p className="surface-elevated mt-1.5 p-2.5 whitespace-pre-wrap text-[12.5px]">
                        {refund.buyerNote}
                      </p>
                    ) : null}

                    {refund.adminNote ? (
                      <p className="surface-elevated mt-1.5 p-2.5 whitespace-pre-wrap text-[12.5px] text-ink-muted">
                        Staff note: {refund.adminNote}
                      </p>
                    ) : null}

                    {refund.stripeRefundId ? (
                      <p className="subtle mt-1 break-all font-mono text-[10.5px]">
                        provider refund {refund.stripeRefundId}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-start gap-3">
                  {refund.status === "REQUESTED" ? (
                    <div className="w-full max-w-md">
                      <RefundDecisionForm action={decideRefundAction} refundId={refund.id} />
                    </div>
                  ) : null}

                  {refund.status === "APPROVED" ? (
                    <div className="w-full max-w-md space-y-3">
                      <StateActionButton
                        action={executeRefundAction}
                        fields={{ refundId: refund.id }}
                        variant="primary"
                        pendingLabel="Sending to provider…"
                        confirm={`Return ${formatMoney(refund.amountMinor, refund.currency)} to the buyer?`}
                      >
                        Send refund to provider
                      </StateActionButton>

                      <StateForm
                        action={failRefundAction}
                        fields={{ refundId: refund.id }}
                        submitLabel="Mark as failed"
                        pendingLabel="Recording…"
                        variant="danger"
                        className="surface-elevated p-2.5"
                      >
                        <label className="label mb-0" htmlFor={`fail-${refund.id}`}>
                          If the provider rejected it, say why
                        </label>
                        <Textarea
                          id={`fail-${refund.id}`}
                          name="reason"
                          rows={2}
                          maxLength={2000}
                          placeholder="e.g. the card was already refunded outside the platform"
                        />
                      </StateForm>
                    </div>
                  ) : null}

                  {refund.status === "PROCESSING" ? (
                    <div className="w-full max-w-md space-y-3">
                      <Alert tone="info">
                        Sent to the provider. The order closes automatically once the confirmed refund
                        event arrives — this page is not proof that the money has moved yet.
                      </Alert>
                      <StateForm
                        action={failRefundAction}
                        fields={{ refundId: refund.id }}
                        submitLabel="Mark as failed"
                        pendingLabel="Recording…"
                        variant="danger"
                        className="surface-elevated p-2.5"
                      >
                        <label className="label mb-0" htmlFor={`fail-${refund.id}`}>
                          Reason the refund did not complete
                        </label>
                        <Textarea
                          id={`fail-${refund.id}`}
                          name="reason"
                          rows={2}
                          maxLength={2000}
                        />
                      </StateForm>
                    </div>
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
