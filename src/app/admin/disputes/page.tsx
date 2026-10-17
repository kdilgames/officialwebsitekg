import Link from "next/link";
import { Gavel } from "lucide-react";

import { Alert, EmptyState } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/table";
import { listDisputes } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Disputes · Admin" };

const STATUS_OPTIONS = [
  { value: "NEEDS_RESPONSE", label: "Needs response" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "WARNING_CLOSED", label: "Warning closed" },
  { value: "ALL", label: "All" },
];

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "ALL";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const result = await listDisputes({ status, page });

  const buildHref = (next: number) => {
    const query = new URLSearchParams();
    if (status !== "ALL") query.set("status", status);
    if (next > 1) query.set("page", String(next));
    const suffix = query.toString();
    return suffix ? `/admin/disputes?${suffix}` : "/admin/disputes";
  };

  const urgent = result.items.filter(
    (dispute: any) =>
      dispute.evidenceDueBy !== null &&
      dispute.status !== "WON" &&
      dispute.status !== "LOST" &&
      daysUntil(dispute.evidenceDueBy) <= 3,
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Disputes</h1>
          <p className="muted mt-1 text-[12.5px]">
            Chargebacks raised by the buyer with their card issuer. These are recorded from verified
            provider webhooks; evidence is submitted from the provider dashboard.
          </p>
        </div>

        <form action="/admin/disputes" className="flex items-center gap-2">
          <label className="label mb-0" htmlFor="status">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status} className="h-8 w-[170px]">
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

      {urgent.length > 0 ? (
        <Alert tone="error" title={`${urgent.length} dispute(s) near the evidence deadline`}>
          {urgent
            .map((dispute: any) =>
              dispute.evidenceDueBy
                ? `${dispute.order.orderNumber} in ${daysUntil(dispute.evidenceDueBy)} day(s)`
                : dispute.order.orderNumber,
            )
            .join(" · ")}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title={`${result.total} dispute${result.total === 1 ? "" : "s"}`}
          description={`Showing page ${result.page} of ${result.totalPages}`}
        />

        {result.items.length === 0 ? (
          <EmptyState
            title="No disputes"
            description="No chargebacks match this filter."
            icon={<Gavel className="size-5" aria-hidden />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                  <th>Evidence due</th>
                  <th>Opened</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((dispute: any) => {
                  const due = dispute.evidenceDueBy;
                  const remaining = due ? daysUntil(due) : null;
                  return (
                    <tr key={dispute.id}>
                      <td className="max-w-[240px]">
                        <Link
                          href={`/admin/orders?q=${encodeURIComponent(dispute.order.orderNumber)}`}
                          className="block font-mono text-[12px] hover:text-accent"
                        >
                          {dispute.order.orderNumber}
                        </Link>
                        <span className="subtle text-[11.5px]">
                          {dispute.stripeDisputeId}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate text-[12.5px]">
                        {dispute.order.buyer.displayName}
                      </td>
                      <td className="max-w-[200px] text-[12.5px] text-ink-muted">
                        {dispute.reason.replaceAll("_", " ").toLowerCase()}
                      </td>
                      <td>
                        <StatusBadge status={dispute.status} />
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {formatMoney(dispute.amountMinor, dispute.currency)}
                      </td>
                      <td className="whitespace-nowrap text-[12px]">
                        {due ? (
                          <span className={remaining !== null && remaining <= 3 ? "text-critical" : ""}>
                            {due.toISOString().slice(0, 10)}
                            {remaining !== null ? ` · ${remaining}d` : ""}
                          </span>
                        ) : (
                          <span className="subtle">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-[11.5px] text-ink-muted">
                        {dispute.createdAt.toISOString().slice(0, 10)}
                        {dispute.resolvedAt ? (
                          <span className="block">
                            closed {dispute.resolvedAt.toISOString().slice(0, 10)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
    </div>
  );
}
