import Link from "next/link";
import { Copyright, ExternalLink } from "lucide-react";

import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { resolveDmcaNoticeAction } from "@/lib/legal/dmca-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "DMCA notices" };

const STATUS_TONE: Record<string, "caution" | "accent" | "critical" | "neutral" | "positive"> = {
  RECEIVED: "caution",
  UNDER_REVIEW: "accent",
  REMOVED: "critical",
  DISMISSED: "neutral",
  COUNTER_NOTICED: "positive",
};

export default async function AdminDmcaPage() {
  const result = await withSchemaFallback(
    async () => {
      const notices = await prisma.dmcaNotice.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          product: { select: { id: true, slug: true, title: true, status: true } },
        },
      });
      return { migrated: true, notices };
    },
    { migrated: false, notices: [] },
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
          <Copyright className="size-4 text-accent" aria-hidden />
          DMCA &amp; Copyright Notices
        </h1>
        <p className="muted mt-1 text-[12.5px]">
          Review copyright takedown notices, suspend infringing listings, or record counter-notices.
        </p>
      </header>

      {!result.migrated ? (
        <Alert tone="warning" title="Database migration pending">
          Run <code>npm run db:deploy</code> to create the <code>DmcaNotice</code> table. Until
          then, new notices submitted via <code>/dmca</code> are captured safely in the Reports
          queue.
        </Alert>
      ) : null}

      {result.migrated && result.notices.length === 0 ? (
        <Card>
          <EmptyState
            title="No DMCA notices"
            description="Copyright takedown notices submitted through /dmca will appear here."
          />
        </Card>
      ) : null}

      <div className="space-y-4">
        {result.notices.map((notice) => (
          <Card key={notice.id}>
            <CardHeader
              title={`${notice.noticeNumber} · ${notice.claimantName}`}
              description={`${notice.claimantEmail}${notice.claimantCompany ? ` · ${notice.claimantCompany}` : ""} · Filed ${notice.createdAt.toISOString().slice(0, 10)}`}
              actions={
                <Badge tone={STATUS_TONE[notice.status] ?? "neutral"}>
                  {notice.status.replace("_", " ")}
                </Badge>
              }
            />
            <CardBody className="space-y-3 text-[13px]">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="subtle text-[11px] font-semibold uppercase">Reported URL</p>
                  <a
                    href={notice.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 break-all text-accent hover:underline"
                  >
                    {notice.productUrl}
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                  {notice.product ? (
                    <p className="mt-1 text-[12px]">
                      Matched listing:{" "}
                      <Link
                        href={`/product/${notice.product.slug}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {notice.product.title}
                      </Link>{" "}
                      <span className="subtle">({notice.product.status})</span>
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="subtle text-[11px] font-semibold uppercase">Original Work</p>
                  <a
                    href={notice.originalWorkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 break-all text-accent hover:underline"
                  >
                    {notice.originalWorkUrl}
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                  <p className="subtle mt-1 text-[11.5px]">Signature: {notice.signature}</p>
                </div>
              </div>

              <div className="rounded-lg border border-line bg-elevated p-3 text-[12.5px] whitespace-pre-wrap">
                {notice.description}
              </div>

              <form action={resolveDmcaNoticeAction} className="space-y-2.5 border-t border-line pt-3">
                <input type="hidden" name="noticeId" value={notice.id} />
                <div className="grid gap-2.5 sm:grid-cols-[180px_1fr]">
                  <select
                    name="status"
                    defaultValue={notice.status === "RECEIVED" ? "UNDER_REVIEW" : notice.status}
                    className="input h-9 text-[12.5px]"
                  >
                    <option value="UNDER_REVIEW">Under review</option>
                    <option value="REMOVED">Removed / Takedown</option>
                    <option value="DISMISSED">Dismissed</option>
                    <option value="COUNTER_NOTICED">Counter-noticed</option>
                  </select>
                  <input
                    name="adminNotes"
                    defaultValue={notice.adminNotes ?? ""}
                    placeholder="Internal resolution notes…"
                    className="input h-9 text-[12.5px]"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {notice.product ? (
                    <label className="flex items-center gap-2 text-[12px] text-ink-muted">
                      <input type="checkbox" name="suspendProduct" value="true" />
                      Suspend matched listing if status is set to Removed
                    </label>
                  ) : (
                    <span />
                  )}
                  <Button type="submit" size="sm" variant="primary">
                    Save decision
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
