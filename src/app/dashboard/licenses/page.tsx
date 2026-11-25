import Link from "next/link";
import { KeyRound } from "lucide-react";

import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireSeller } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { env } from "@/lib/env";
import { toggleLicenseKeyStatusAction } from "@/lib/licenses/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "License keys" };

export default async function SellerLicensesPage() {
  const user = await requireSeller();

  const data = await withSchemaFallback(
    async () => {
      const keys = await prisma.licenseKey.findMany({
        where: { sellerId: user.sellerProfile.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          product: { select: { title: true, slug: true } },
          buyer: { select: { username: true, email: true } },
          orderItem: { select: { order: { select: { orderNumber: true } } } },
        },
      });
      return { migrated: true, keys };
    },
    { migrated: false, keys: [] },
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
          <KeyRound className="size-4 text-accent" aria-hidden />
          License keys
        </h1>
        <p className="muted mt-1 text-[12.5px]">
          Every completed order automatically receives a unique license key. Verify keys directly
          from your plugin or app via{" "}
          <code className="rounded border border-line bg-elevated px-1 py-0.5 text-[11.5px]">
            POST {env.siteUrl}/api/licenses/verify
          </code>
          .
        </p>
      </header>

      {!data.migrated ? (
        <Alert tone="warning" title="Database migration pending">
          Run <code>npm run db:deploy</code> to enable automated license key issuance.
        </Alert>
      ) : null}

      {data.migrated && data.keys.length === 0 ? (
        <Card>
          <EmptyState
            title="No license keys issued yet"
            description="License keys are generated automatically whenever a buyer completes a purchase or free claim."
          />
        </Card>
      ) : null}

      {data.keys.length > 0 ? (
        <Card>
          <CardHeader
            title={`Issued keys (${data.keys.length})`}
            description="Revoke keys in case of chargebacks or license violations."
          />
          <div className="divide-y divide-line">
            {data.keys.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded border border-line bg-elevated px-2 py-0.5 font-mono text-[12px] font-medium text-ink">
                      {entry.key}
                    </code>
                    <Badge tone={entry.status === "ACTIVE" ? "positive" : "critical"}>
                      {entry.status}
                    </Badge>
                    <span className="subtle text-[11.5px] tabular-nums">
                      {entry.activationsCount}/{entry.maxActivations} activations
                    </span>
                  </div>
                  <p className="muted mt-1 text-[12px]">
                    <Link
                      href={`/product/${entry.product.slug}`}
                      className="font-medium text-ink hover:text-accent"
                    >
                      {entry.product.title}
                    </Link>{" "}
                    · Buyer @{entry.buyer.username} · Order {entry.orderItem.order.orderNumber} ·{" "}
                    {entry.createdAt.toISOString().slice(0, 10)}
                  </p>
                </div>

                <form action={toggleLicenseKeyStatusAction}>
                  <input type="hidden" name="licenseId" value={entry.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={entry.status === "ACTIVE" ? "REVOKED" : "ACTIVE"}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant={entry.status === "ACTIVE" ? "danger" : "secondary"}
                  >
                    {entry.status === "ACTIVE" ? "Revoke" : "Reactivate"}
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="API verification example" />
        <CardBody>
          <pre className="overflow-x-auto rounded-lg border border-line bg-elevated p-3 font-mono text-[11.5px] text-ink">
{`curl -X POST ${env.siteUrl}/api/licenses/verify \\
  -H "Content-Type: application/json" \\
  -d '{"key":"KDIL-XXXX-XXXX-XXXX-XXXX","productSlug":"your-product-slug","activate":true}'`}
          </pre>
        </CardBody>
      </Card>
    </div>
  );
}
