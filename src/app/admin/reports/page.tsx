import Link from "next/link";
import { Flag } from "lucide-react";

import { ReportDecisionForm } from "@/components/admin/admin-forms";
import { EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/table";
import { resolveReportAction } from "@/lib/admin/actions";
import { describeReportTargets, listReports } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports · Admin" };

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "DISMISSED", label: "Dismissed" },
  { value: "ALL", label: "All" },
];

const TARGET_LABELS: Record<string, string> = {
  PRODUCT: "Product",
  USER: "Account",
  REVIEW: "Review",
  MESSAGE: "Message",
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "OPEN";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const result = await listReports({ status, page });
  const targets = await describeReportTargets(result.items);

  const buildHref = (next: number) => {
    const query = new URLSearchParams();
    if (status !== "OPEN") query.set("status", status);
    if (next > 1) query.set("page", String(next));
    const suffix = query.toString();
    return suffix ? `/admin/reports?${suffix}` : "/admin/reports";
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Reports</h1>
          <p className="muted mt-1 text-[12.5px]">
            Reports filed by the community. Closing a report requires a finding, and the reporter is
            told the outcome.
          </p>
        </div>

        <form action="/admin/reports" className="flex items-center gap-2">
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

      <Card>
        <CardHeader
          title={`${result.total} report${result.total === 1 ? "" : "s"}`}
          description={`Showing page ${result.page} of ${result.totalPages}`}
        />

        {result.items.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description="No reports match this filter."
            icon={<Flag className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-line">
            {result.items.map((report: any) => {
              const target = targets[report.targetId];
              return (
                <li key={report.id} className="space-y-3 px-4 py-4">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">
                        {TARGET_LABELS[report.targetType] ?? report.targetType}
                      </Badge>
                      <span className="text-[13px] font-medium">{report.reason}</span>
                      {report.status === "OPEN" ? <Badge tone="caution">open</Badge> : null}
                      {report.status === "UNDER_REVIEW" ? (
                        <Badge tone="caution">under review</Badge>
                      ) : null}
                      {report.status === "RESOLVED" ? <Badge tone="positive">resolved</Badge> : null}
                      {report.status === "DISMISSED" ? <Badge>dismissed</Badge> : null}
                    </div>

                    <p className="text-[12.5px]">
                      Target:{" "}
                      {target?.href ? (
                        <Link href={target.href} className="text-accent hover:underline">
                          {target.label}
                        </Link>
                      ) : (
                        <span>{target?.label ?? "The reported record no longer exists"}</span>
                      )}
                    </p>

                    {report.details ? (
                      <p className="surface-elevated whitespace-pre-wrap p-2.5 text-[12.5px] text-ink-muted">
                        {report.details}
                      </p>
                    ) : null}

                    <p className="subtle text-[11.5px]">
                      {report.reporter
                        ? `Reported by ${report.reporter.displayName} (@${report.reporter.username})`
                        : "Reported anonymously"}
                      {" · "}
                      {report.createdAt.toISOString().slice(0, 10)}
                      {report.handledBy
                        ? ` · handled by ${report.handledBy.displayName}`
                        : ""}
                      {report.handledAt
                        ? ` on ${report.handledAt.toISOString().slice(0, 10)}`
                        : ""}
                    </p>

                    {report.resolutionNote ? (
                      <p className="text-[12px] text-ink-muted">
                        Finding: {report.resolutionNote}
                      </p>
                    ) : null}
                  </div>

                  {report.status === "OPEN" || report.status === "UNDER_REVIEW" ? (
                    <div className="max-w-lg">
                      <ReportDecisionForm
                        action={resolveReportAction}
                        reportId={report.id}
                        status={report.status}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
    </div>
  );
}
