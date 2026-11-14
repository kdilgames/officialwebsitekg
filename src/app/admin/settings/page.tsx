import Link from "next/link";
import { Settings2 } from "lucide-react";

import {
  AnnouncementForm,
  DiscordInviteForm,
  SiteSettingForm,
} from "@/components/admin/admin-forms";
import { ActionButton } from "@/components/admin/action-forms";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  deleteSiteSettingAction,
  saveAnnouncementAction,
  saveDiscordSettingAction,
  saveSiteSettingAction,
} from "@/lib/admin/actions";
import { listSiteSettings } from "@/lib/admin/queries";
import { env } from "@/lib/env";
import { getSiteAnnouncementRaw } from "@/lib/settings";

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
  const [settings, announcement] = await Promise.all([
    listSiteSettings(),
    getSiteAnnouncementRaw(),
  ]);

  const discordSetting = settings.find((row) => row.key === "community_discord_url");
  const defaultDiscordUrl =
    typeof discordSetting?.value === "string"
      ? discordSetting.value
      : (env.marketplace.discordUrl ?? "");

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Platform settings</h1>
          <p className="muted mt-1 text-[12.5px]">
            Editable configuration that does not require a deployment. Commission rates live under{" "}
            <Link href="/admin/commissions" className="underline hover:text-ink">
              Commissions
            </Link>{" "}
            and staff emails under{" "}
            <Link href="/admin/access" className="underline hover:text-ink">
              Access &amp; Emails
            </Link>
            .
          </p>
        </div>
      </header>

      <Alert tone="info" title="Environment-controlled settings">
        The owner email is <code>{env.auth.ownerEmail}</code>, marketplace commission default is{" "}
        {(env.marketplace.defaultCommissionBps / 100).toFixed(2)}%, earnings hold is{" "}
        {env.marketplace.earningsHoldDays} day(s), and Stripe automatic tax (EU VAT) is currently{" "}
        <strong>{env.stripe.automaticTax ? "enabled" : "disabled"}</strong> (controlled via{" "}
        <code>STRIPE_AUTOMATIC_TAX=true</code> on deployment).
      </Alert>

      <Card>
        <CardHeader
          title="Storefront announcement banner"
          description="Shown neatly at the very top of marketplace pages for launches, coupons, or maintenance notices."
          actions={
            announcement ? (
              <Badge tone={announcement.enabled ? "positive" : "caution"}>
                {announcement.enabled ? "active" : "paused"}
              </Badge>
            ) : (
              <Badge>not set</Badge>
            )
          }
        />
        <CardBody>
          <AnnouncementForm
            action={saveAnnouncementAction}
            defaults={{
              enabled: announcement?.enabled ?? true,
              text: announcement?.text ?? "",
              href: announcement?.href ?? "",
              linkLabel: announcement?.linkLabel ?? "",
              tone: announcement?.tone ?? "info",
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Community Discord invite"
          description="Sets community_discord_url surfaced in the storefront footer and seller onboarding page."
          actions={defaultDiscordUrl ? <Badge tone="positive">configured</Badge> : <Badge>hidden</Badge>}
        />
        <CardBody>
          <DiscordInviteForm action={saveDiscordSettingAction} defaultUrl={defaultDiscordUrl} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Custom / advanced setting" description="Stored as JSON when the value parses as JSON." />
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
