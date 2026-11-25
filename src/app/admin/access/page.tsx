import Link from "next/link";
import { CheckCircle2, Lock, Mail, ScrollText, ShieldAlert, ShieldCheck } from "lucide-react";

import { StateActionButton } from "@/components/admin/action-forms";
import { GrantAdminEmailForm } from "@/components/admin/admin-forms";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { grantAdminByEmailAction, revokeAdminAccessAction } from "@/lib/admin/actions";
import { getAdminAccessOverview } from "@/lib/admin/queries";
import { normalizeEmail } from "@/lib/auth/admin-access-rules";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Access & Emails · Admin" };

export default async function AdminAccessPage() {
  const [overview, currentUser] = await Promise.all([
    getAdminAccessOverview(),
    getSessionUser(),
  ]);

  const ownerUser = overview.ownerEntry.user;
  const currentEmail = normalizeEmail(currentUser?.email);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Access &amp; email ownership</h1>
          <p className="muted mt-1 text-[12.5px]">
            Administrator roles are tied to verified email addresses. Unverified sign-ups never gain
            access, and the primary owner account is protected from demotion or suspension.
          </p>
        </div>
        <Link href="/admin/users" className="btn btn-secondary btn-sm">
          View all accounts
        </Link>
      </header>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" aria-hidden />
              Primary owner email
            </span>
          }
          description="Configured as the marketplace owner address (ADMIN_OWNER_EMAIL)."
          actions={<Badge tone="accent">owner · protected</Badge>}
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[14px] font-semibold text-ink">{overview.ownerEmail}</p>
              {ownerUser ? (
                <p className="muted mt-1 text-[12.5px]">
                  Linked to{" "}
                  <span className="font-medium text-ink">
                    {ownerUser.displayName} (@{ownerUser.username})
                  </span>
                  {ownerUser.lastLoginAt
                    ? ` · last signed in ${ownerUser.lastLoginAt.toISOString().slice(0, 10)}`
                    : ""}
                </p>
              ) : (
                <p className="muted mt-1 text-[12.5px]">
                  No local profile row yet. Sign in on{" "}
                  <Link href="/login?next=%2Fadmin" className="text-accent hover:underline">
                    /login
                  </Link>{" "}
                  using the Email link option or standard registration to activate.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {ownerUser ? (
                <>
                  {ownerUser.emailVerified ? (
                    <Badge tone="positive">
                      <CheckCircle2 className="mr-1 size-3" aria-hidden />
                      Email verified
                    </Badge>
                  ) : (
                    <Badge tone="caution">Awaiting verification</Badge>
                  )}
                  <Badge tone={ownerUser.role === "ADMIN" ? "accent" : "neutral"}>
                    {ownerUser.role.toLowerCase()}
                  </Badge>
                  <StatusBadge status={ownerUser.status} />
                </>
              ) : (
                <Badge tone="caution">Awaiting first sign-in</Badge>
              )}
            </div>
          </div>

          {ownerUser && !ownerUser.emailVerified ? (
            <Alert tone="warning" title="Email confirmation required">
              The account registered with {overview.ownerEmail} has not verified its inbox yet. Once
              verified, <code>ADMIN</code> privileges activate automatically.
            </Alert>
          ) : null}

          <div className="surface-elevated flex items-start gap-2.5 p-3 text-[12px] text-ink-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" aria-hidden />
            <p>
              Passwordless one-click sign-in is enabled on <code>/login</code> via the{" "}
              <strong>Email link</strong> tab. Only requests confirmed through the owner&apos;s
              verified inbox can open this session.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Authorize another administrator by email"
          description="Grant dashboard access to a trusted co-owner, moderator, or operations teammate."
        />
        <CardBody>
          <GrantAdminEmailForm action={grantAdminByEmailAction} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`${overview.entries.length} authorized email${overview.entries.length === 1 ? "" : "s"}`}
          description="Combined view of the owner address, environment allowlist (ADMIN_EMAILS), UI allowlist, and current ADMIN accounts."
        />

        {overview.entries.length === 0 ? (
          <EmptyState
            title="No administrator emails found"
            description="Authorize an email above to grant staff access."
            icon={<Mail className="size-5" aria-hidden />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Email &amp; access source</th>
                  <th>Linked account</th>
                  <th>Verification</th>
                  <th>Last sign in</th>
                  <th className="text-right">Access control</th>
                </tr>
              </thead>
              <tbody>
                {overview.entries.map((entry) => {
                  const isSelf = normalizeEmail(entry.email) === currentEmail;
                  const canRevoke = !entry.isOwner && !isSelf;

                  return (
                    <tr key={entry.email}>
                      <td className="max-w-[280px]">
                        <p className="truncate font-mono text-[12.5px] font-medium text-ink">
                          {entry.email}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {entry.sources.map((source) => (
                            <Badge
                              key={source}
                              tone={source === "owner" ? "accent" : "neutral"}
                            >
                              {source === "role" ? "direct role" : source}
                            </Badge>
                          ))}
                        </div>
                      </td>

                      <td className="max-w-[220px]">
                        {entry.user ? (
                          <div>
                            <p className="truncate text-[12.5px] font-medium text-ink">
                              {entry.user.displayName}
                            </p>
                            <p className="subtle truncate text-[11.5px]">
                              @{entry.user.username} · {entry.user.role.toLowerCase()}
                            </p>
                          </div>
                        ) : (
                          <span className="subtle text-[12px]">Not registered yet</span>
                        )}
                      </td>

                      <td>
                        {entry.user ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {entry.user.emailVerified ? (
                              <Badge tone="positive">verified</Badge>
                            ) : (
                              <Badge tone="caution">unverified</Badge>
                            )}
                            {entry.user.status !== "ACTIVE" ? (
                              <StatusBadge status={entry.user.status} />
                            ) : null}
                          </div>
                        ) : (
                          <Badge tone="caution">pending signup</Badge>
                        )}
                      </td>

                      <td className="whitespace-nowrap text-[12px] text-ink-muted">
                        {entry.user?.lastLoginAt
                          ? entry.user.lastLoginAt.toISOString().slice(0, 10)
                          : "—"}
                      </td>

                      <td className="text-right">
                        {entry.isOwner ? (
                          <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-subtle">
                            <Lock className="size-3" aria-hidden />
                            Protected owner
                          </span>
                        ) : isSelf ? (
                          <Badge tone="accent">current session</Badge>
                        ) : canRevoke ? (
                          <div className="inline-flex flex-col items-end gap-1">
                            <StateActionButton
                              action={revokeAdminAccessAction}
                              fields={{ email: entry.email }}
                              variant="danger"
                              confirm={`Revoke administrator privileges for ${entry.email}?`}
                              pendingLabel="Revoking…"
                            >
                              Revoke admin
                            </StateActionButton>
                            {entry.isEnvManaged ? (
                              <span className="subtle text-[10.5px]">
                                Also set in ADMIN_EMAILS env
                              </span>
                            ) : null}
                          </div>
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

      <Card>
        <CardHeader
          title="Recent access &amp; promotion activity"
          description="Audit events for owner auto-elevation, email grants, revocations, and manual role changes."
          actions={
            <Link href="/admin/audit" className="btn btn-secondary btn-sm">
              Full audit log
            </Link>
          }
        />

        {overview.recentAccessEvents.length === 0 ? (
          <EmptyState
            title="No access changes logged yet"
            description="Role promotions and email authorizations appear here automatically."
            icon={<ScrollText className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-line">
            {overview.recentAccessEvents.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12.5px]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldAlert className="size-3.5 text-ink-subtle" aria-hidden />
                  <span className="font-mono text-[12px] font-medium text-ink">{event.action}</span>
                  {event.actor ? (
                    <span className="muted">by @{event.actor.username}</span>
                  ) : (
                    <span className="muted">system</span>
                  )}
                  {event.after && typeof event.after === "object" && "email" in event.after ? (
                    <span className="font-mono text-[11.5px] text-ink-muted">
                      ({String((event.after as Record<string, unknown>).email)})
                    </span>
                  ) : null}
                </div>
                <span className="subtle text-[11.5px] tabular-nums">
                  {event.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
