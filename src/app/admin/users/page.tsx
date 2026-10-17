import Link from "next/link";
import { Users } from "lucide-react";

import { UserRoleForm } from "@/components/admin/admin-forms";
import { ActionButton, ReasonForm } from "@/components/admin/action-forms";
import { EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/table";
import { reinstateUserAction, suspendUserAction, updateUserRoleAction } from "@/lib/admin/actions";
import { listUsers } from "@/lib/admin/queries";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users · Admin" };

const ROLE_OPTIONS = [
  { value: "ALL", label: "All roles" },
  { value: "USER", label: "Buyers" },
  { value: "SELLER", label: "Sellers" },
  { value: "ADMIN", label: "Admins" },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  const params = await searchParams;
  const role = params.role ?? "ALL";
  const q = params.q?.trim() ?? "";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const [result, currentUser] = await Promise.all([listUsers({ q, role, page }), getSessionUser()]);

  const buildHref = (next: number) => {
    const query = new URLSearchParams();
    if (role !== "ALL") query.set("role", role);
    if (q) query.set("q", q);
    if (next > 1) query.set("page", String(next));
    const suffix = query.toString();
    return suffix ? `/admin/users?${suffix}` : "/admin/users";
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Users</h1>
        <p className="muted mt-1 text-[12.5px]">
          Accounts, roles and suspensions. The last active administrator cannot be demoted, and an
          administrator cannot suspend their own account or another administrator&apos;s.
        </p>
      </header>

      <form action="/admin/users" className="surface flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-[220px] flex-1">
          <label className="label mb-1.5" htmlFor="q">
            Search
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="Username, display name or email" />
        </div>
        <div className="w-[160px]">
          <label className="label mb-1.5" htmlFor="role">
            Role
          </label>
          <Select id="role" name="role" defaultValue={role}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <button type="submit" className="btn btn-primary btn-sm">
          Apply
        </button>
        <Link href="/admin/users" className="btn btn-secondary btn-sm">
          Reset
        </Link>
      </form>

      <Card>
        <CardHeader
          title={`${result.total} account${result.total === 1 ? "" : "s"}`}
          description={`Showing page ${result.page} of ${result.totalPages}`}
        />

        {result.items.length === 0 ? (
          <EmptyState
            title="No accounts match"
            description="Try another role or clear the search term."
            icon={<Users className="size-5" aria-hidden />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Store</th>
                  <th className="text-right">Orders</th>
                  <th>Role</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((account: any) => {
                  const isSelf = account.id === currentUser?.id;
                  return (
                    <tr key={account.id}>
                      <td className="max-w-[280px]">
                        <span className="block truncate font-medium">{account.displayName}</span>
                        <span className="subtle block truncate text-[11.5px]">
                          @{account.username} · {account.email}
                          {account.emailVerified ? "" : " · unverified"}
                        </span>
                        <span className="subtle block text-[11.5px]">
                          joined {account.createdAt.toISOString().slice(0, 10)}
                          {account.lastLoginAt
                            ? ` · last seen ${account.lastLoginAt.toISOString().slice(0, 10)}`
                            : ""}
                          {account.country ? ` · ${account.country}` : ""}
                        </span>
                        {account.suspendedReason ? (
                          <span className="mt-0.5 block text-[11.5px] text-critical">
                            {account.suspendedReason}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <StatusBadge status={account.status} />
                      </td>
                      <td className="max-w-[180px]">
                        {account.sellerProfile ? (
                          <div className="flex flex-col items-start gap-1">
                            <Link
                              href="/admin/sellers"
                              className="max-w-full truncate text-[12.5px] hover:text-accent"
                            >
                              {account.sellerProfile.storeName}
                            </Link>
                            <StatusBadge status={account.sellerProfile.status} />
                          </div>
                        ) : (
                          <span className="subtle text-[11.5px]">—</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{account._count.orders}</td>
                      <td>
                        {isSelf ? (
                          <Badge tone="accent">you · admin</Badge>
                        ) : (
                          <UserRoleForm
                            action={updateUserRoleAction}
                            userId={account.id}
                            role={account.role}
                          />
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-start justify-end gap-1.5">
                          {account.status === "ACTIVE" &&
                          !isSelf &&
                          account.role !== "ADMIN" ? (
                            <ReasonForm
                              action={suspendUserAction}
                              fields={{ userId: account.id }}
                              label="Suspend"
                              submitLabel="Suspend account"
                              placeholder="Why is this account being suspended? Their listings are removed from the storefront."
                              confirm="Suspend this account?"
                            />
                          ) : null}

                          {account.status === "SUSPENDED" ? (
                            <ActionButton
                              action={reinstateUserAction}
                              fields={{ userId: account.id }}
                              variant="primary"
                            >
                              Reinstate
                            </ActionButton>
                          ) : null}

                          {account.role === "ADMIN" && !isSelf ? (
                            <span className="subtle self-center text-[11.5px]">
                              Admin accounts cannot be suspended
                            </span>
                          ) : null}
                        </div>
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
