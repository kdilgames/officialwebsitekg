import Link from "next/link";
import { ScrollText } from "lucide-react";

import { EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Pagination } from "@/components/ui/table";
import { listAuditLogs } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log · Admin" };

function renderJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const params = await searchParams;
  const action = params.action?.trim() ?? "";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const result = await listAuditLogs({ action, page });

  const buildHref = (next: number) => {
    const query = new URLSearchParams();
    if (action) query.set("action", action);
    if (next > 1) query.set("page", String(next));
    const suffix = query.toString();
    return suffix ? `/admin/audit?${suffix}` : "/admin/audit";
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Audit log</h1>
        <p className="muted mt-1 text-[12.5px]">
          Every administrative and seller decision is recorded with its actor, target and previous
          value. Entries are append-only.
        </p>
      </header>

      <form action="/admin/audit" className="surface flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-[240px] flex-1">
          <label className="label mb-1.5" htmlFor="action">
            Action contains
          </label>
          <Input
            id="action"
            name="action"
            defaultValue={action}
            placeholder="e.g. product, refund, user.suspended"
          />
        </div>
        <button type="submit" className="btn btn-primary btn-sm">
          Filter
        </button>
        <Link href="/admin/audit" className="btn btn-secondary btn-sm">
          Reset
        </Link>
      </form>

      <Card>
        <CardHeader
          title={`${result.total} entr${result.total === 1 ? "y" : "ies"}`}
          description={`Showing page ${result.page} of ${result.totalPages}`}
        />

        {result.items.length === 0 ? (
          <EmptyState
            title="No entries"
            description="No audit entries match this filter."
            icon={<ScrollText className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-line">
            {result.items.map((entry: any) => (
              <li key={entry.id} className="space-y-2 px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] font-medium">{entry.action}</span>
                  <Badge tone={entry.actorRole === "ADMIN" ? "accent" : "neutral"}>
                    {entry.actorRole ? entry.actorRole.toLowerCase() : "system"}
                  </Badge>
                  <span className="subtle text-[11.5px]">
                    {entry.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                  </span>
                </div>

                <p className="muted text-[12px]">
                  {entry.actor ? (
                    <>{entry.actor.displayName} (@{entry.actor.username})</>
                  ) : (
                    "System"
                  )}
                  {entry.entityType ? ` · ${entry.entityType}` : ""}
                  {entry.entityId ? (
                    <span className="font-mono text-[11px]"> {entry.entityId}</span>
                  ) : null}
                  {entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
                </p>

                {entry.before !== null || entry.after !== null ? (
                  <details>
                    <summary className="cursor-pointer text-[12px] text-ink-muted hover:text-ink">
                      Change detail
                    </summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="surface-elevated p-2.5">
                        <p className="subtle text-[11px] font-medium uppercase tracking-[0.04em]">
                          Before
                        </p>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-ink-muted">
                          {renderJson(entry.before)}
                        </pre>
                      </div>
                      <div className="surface-elevated p-2.5">
                        <p className="subtle text-[11px] font-medium uppercase tracking-[0.04em]">
                          After
                        </p>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-ink-muted">
                          {renderJson(entry.after)}
                        </pre>
                      </div>
                    </div>
                  </details>
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
