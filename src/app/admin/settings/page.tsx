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

      <Alert tone="info" title="What is not configurable here">
        The marketplace commission default is currently{" "}
        {(env.marketplace.defaultCommissionBps / 100).toFixed(2)}% and the earnings hold is{" "}
        {env.marketplace.earningsHoldDays} day(s). Both come from environment variables, so a change
        needs a deployment — this prevents a setting from silently altering money already in flight.
      </Alert>

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
            {settings.map((setting) => (
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
