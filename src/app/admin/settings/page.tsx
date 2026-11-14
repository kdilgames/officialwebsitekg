import Link from "next/link";
import { Settings2 } from "lucide-react";

import { SiteSettingForm } from "@/components/admin/admin-forms";
import { ActionButton } from "@/components/admin/action-forms";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { deleteSiteSettingAction, saveSiteSettingAction } from "@/lib/admin/actions";
import { listSiteSettings } from "@/lib/admin/queries";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Admin" };

/** A stored JSON value is shown as editable text without losing its shape. */
function asEditableText(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default async function AdminSettingsPage() {
  const settings = await listSiteSettings();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Platform settings</h1>
        <p className="muted mt-1 text-[12.5px]">
          Editable configuration that does not require a deployment. Commission rates live under{" "}
          <Link href="/admin/commissions" className="underline hover:text-ink">
            Commissions
          </Link>{" "}
          because they carry financial consequences.
        </p>
      </header>

      <Alert tone="info" title="Environment-controlled settings">
        The marketplace commission default is{" "}
        {(env.marketplace.defaultCommissionBps / 100).toFixed(2)}%, earnings hold is{" "}
        {env.marketplace.earningsHoldDays} day(s), and Stripe automatic tax (EU VAT) is currently{" "}
        <strong>{env.stripe.automaticTax ? "enabled" : "disabled"}</strong> (controlled via{" "}
        <code>STRIPE_AUTOMATIC_TAX=true</code> on deployment).
      </Alert>

      <Card>
        <CardHeader
          title="Built-in optional SiteSetting keys"
          description="Optional runtime keys recognized across the storefront layout."
        />
        <CardBody className="space-y-2 text-[12.5px] text-ink-muted">
          <div className="surface-elevated p-3">
            <p className="font-mono text-[12px] font-semibold text-ink">community_discord_url</p>
            <p className="mt-1">
              Set to a valid Discord invite URL (e.g.{" "}
              <code>https://discord.gg/your-invite</code>) to surface Community Discord links in
              the site footer and seller onboarding page. Delete or leave unset to hide Discord
              links everywhere.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="New setting" description="Stored as JSON when the value parses as JSON." />
        <CardBody>
          <SiteSettingForm action={saveSiteSettingAction} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`${settings.length} setting${settings.length === 1 ? "" : "s"}`}
          description="Each change is written to the audit log with its previous value."
        />

        {settings.length === 0 ? (
          <EmptyState
            title="No settings yet"
            description="Create a key above to store configuration such as a site announcement."
            icon={<Settings2 className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-line">
            {settings.map((setting: any) => (
              <li key={setting.key} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[12.5px] font-medium">{setting.key}</p>
                    {setting.description ? (
                      <p className="muted mt-0.5 text-[12px]">{setting.description}</p>
                    ) : null}
                    <p className="subtle mt-0.5 text-[11.5px]">
                      Updated {setting.updatedAt.toISOString().slice(0, 10)}
                      {setting.updatedBy ? ` by ${setting.updatedBy.displayName}` : ""}
                    </p>
                  </div>

                  <ActionButton
                    action={deleteSiteSettingAction}
                    fields={{ key: setting.key }}
                    variant="danger"
                    confirm={`Delete the setting “${setting.key}”?`}
                  >
                    Delete
                  </ActionButton>
                </div>

                <details>
                  <summary className="cursor-pointer text-[12px] text-ink-muted hover:text-ink">
                    Edit value
                  </summary>
                  <div className="surface-elevated mt-2 p-3">
                    <SiteSettingForm
                      action={saveSiteSettingAction}
                      defaults={{
                        key: setting.key,
                        value: asEditableText(setting.value),
                        description: setting.description ?? "",
                      }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
