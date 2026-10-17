import Link from "next/link";
import { Percent } from "lucide-react";

import { CommissionRuleForm } from "@/components/admin/admin-forms";
import { ActionButton } from "@/components/admin/action-forms";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { deleteCommissionRuleAction, saveCommissionRuleAction } from "@/lib/admin/actions";
import {
  listAllCategories,
  listCommissionRules,
  listProductOptions,
  listSellerOptions,
} from "@/lib/admin/queries";
import { formatBps } from "@/lib/commission";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Commissions · Admin" };

export default async function AdminCommissionsPage() {
  const [rules, categories, sellers, products] = await Promise.all([
    listCommissionRules(),
    listAllCategories(),
    listSellerOptions(),
    listProductOptions(),
  ]);

  const labels = new Map<string, string>([
    ...categories.map((row) => [row.id, row.name] as const),
    ...sellers.map((row) => [row.id, row.storeName] as const),
    ...products.map((row) => [row.id, row.title] as const),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Commission rates</h1>
        <p className="muted mt-1 text-[12.5px]">
          The platform keeps a percentage of every sale and the remainder goes to the seller. When a
          sale settles, the rate is resolved and the split is written onto the order line — changing
          a rate never rewrites an order that has already been placed.
        </p>
      </header>

      <Alert tone="info" title="How a rate is chosen">
        Precedence, highest first: a product rule → the seller&apos;s individual override → a seller
        rule → a category rule → the global rule → the built-in default of{" "}
        {(env.marketplace.defaultCommissionBps / 100).toFixed(2)}%. Saving a rule for a scope and
        target that already exists updates it in place.
      </Alert>

      <Card>
        <CardHeader
          title="Create or update a rate"
          description="The rate applies to orders placed from now on."
        />
        <CardBody>
          <CommissionRuleForm
            action={saveCommissionRuleAction}
            categories={categories.map((row) => ({ id: row.id, name: row.name }))}
            sellers={sellers.map((row) => ({ id: row.id, storeName: row.storeName }))}
            products={products.map((row) => ({ id: row.id, title: row.title }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`${rules.length} override${rules.length === 1 ? "" : "s"}`}
          description="Only overrides are stored; anything without a rule falls back to the default."
        />

        {rules.length === 0 ? (
          <EmptyState
            title="No commission overrides"
            description={`Every sale currently uses the default of ${(env.marketplace.defaultCommissionBps / 100).toFixed(2)}%.`}
            icon={<Percent className="size-5" aria-hidden />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Target</th>
                  <th className="text-right">Rate</th>
                  <th>State</th>
                  <th>Note</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="whitespace-nowrap">
                      <Badge tone={rule.scope === "GLOBAL" ? "accent" : "neutral"}>
                        {rule.scope.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="max-w-[240px]">
                      {rule.scope === "GLOBAL" ? (
                        <span className="muted">Every product</span>
                      ) : (
                        <Link
                          href={
                            rule.scope === "SELLER"
                              ? "/admin/sellers"
                              : rule.scope === "CATEGORY"
                                ? "/admin/categories"
                                : "/admin/products"
                          }
                          className="block truncate hover:text-accent"
                        >
                          {rule.targetId
                            ? (labels.get(rule.targetId) ?? "Deleted record")
                            : "No target"}
                        </Link>
                      )}
                    </td>
                    <td className="text-right font-medium tabular-nums">
                      {formatBps(rule.rateBps)}
                    </td>
                    <td>
                      {rule.isActive ? (
                        <Badge tone="positive">active</Badge>
                      ) : (
                        <Badge tone="caution">disabled</Badge>
                      )}
                    </td>
                    <td className="max-w-[220px] text-[12.5px] text-ink-muted">
                      {rule.note ?? <span className="subtle">—</span>}
                    </td>
                    <td className="whitespace-nowrap text-[11.5px] text-ink-muted">
                      {rule.updatedAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="text-right">
                      <ActionButton
                        action={deleteCommissionRuleAction}
                        fields={{ ruleId: rule.id }}
                        variant="danger"
                        confirm="Delete this override? Sales will fall back to the next matching rate."
                      >
                        Delete
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
