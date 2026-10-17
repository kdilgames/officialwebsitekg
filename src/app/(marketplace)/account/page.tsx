import Link from "next/link";
import { Download, ShoppingBag, Wallet } from "lucide-react";

import { ImageUploader } from "@/components/account/image-uploader";
import { DeleteAccountForm, ProfileForm } from "@/components/forms/account-forms";
import { ChangePasswordForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import {
  deleteAccountAction,
  finalizeAvatarUploadAction,
  requestAvatarUpload,
  updateProfileAction,
} from "@/lib/account/actions";
import { changePasswordAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings" };

export default async function AccountPage() {
  const user = await requireUser("/account");

  const [paidOrders, wishlistCount, downloadCount] = await Promise.all([
    prisma.order.findMany({
      where: { buyerId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
      select: { currency: true, totalMinor: true },
    }),
    prisma.wishlistItem.count({ where: { userId: user.id } }),
    prisma.downloadRecord.count({ where: { userId: user.id } }),
  ]);

  // Totals are grouped per currency: summing across currencies would be wrong.
  const spendByCurrency = new Map<string, number>();
  for (const order of paidOrders) {
    spendByCurrency.set(
      order.currency,
      (spendByCurrency.get(order.currency) ?? 0) + order.totalMinor,
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">{user.displayName}</h1>
          <p className="muted mt-1 text-[12.5px]">
            @{user.username} · joined {user.createdAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {user.emailVerified ? (
            <Badge tone="positive">Email verified</Badge>
          ) : (
            <Badge tone="caution">Email not verified</Badge>
          )}
          <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>{user.role.toLowerCase()}</Badge>
        </div>
      </header>

      {user.emailVerified ? null : (
        <Alert tone="warning" title="Verify your email address">
          We sent a confirmation link to {user.email}. Verifying is required before you can apply to
          sell or receive payouts.
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Orders"
          value={String(paidOrders.length)}
          icon={<ShoppingBag className="size-4" aria-hidden />}
        />
        <StatCard
          label="Total spent"
          value={
            spendByCurrency.size === 0
              ? formatMoney(0, "EUR")
              : [...spendByCurrency.entries()]
                  .map(([currency, minor]) => formatMoney(minor, currency))
                  .join(" · ")
          }
          icon={<Wallet className="size-4" aria-hidden />}
          hint="Paid orders only, per currency"
        />
        <StatCard
          label="Downloads"
          value={String(downloadCount)}
          icon={<Download className="size-4" aria-hidden />}
          hint={`${wishlistCount} saved to wishlist`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" description="How you appear to sellers and in reviews." />
          <CardBody className="space-y-4">
            <ImageUploader
              title="Profile picture"
              hint="Shown next to your reviews and in the account menu."
              recommended="Square images work best, 512×512 or larger."
              currentUrl={user.avatarUrl}
              fallback={user.displayName.slice(0, 1).toUpperCase()}
              maxBytes={env.uploads.maxAvatarBytes}
              requestUpload={requestAvatarUpload}
              finalize={finalizeAvatarUploadAction}
            />

            <div className="divider" />

            <ProfileForm
              action={updateProfileAction}
              defaults={{
                displayName: user.displayName,
                bio: user.bio ?? "",
                country: user.country ?? "",
                marketingOptIn: user.marketingOptIn,
              }}
            />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Password"
              description="Changing it keeps you signed in on this device."
            />
            <CardBody>
              <ChangePasswordForm action={changePasswordAction} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Selling"
              description="Seller stores are reviewed before products go live."
              actions={
                user.sellerProfile ? (
                  <StatusBadge status={user.sellerProfile.status} />
                ) : (
                  <Badge>Not a seller</Badge>
                )
              }
            />
            <CardBody className="space-y-2 text-[12.5px]">
              {user.sellerProfile ? (
                <p className="muted">
                  Store: <span className="text-ink">{user.sellerProfile.storeName}</span>
                </p>
              ) : (
                <p className="muted">
                  Sell Roblox scripts, Minecraft plugins, Discord bots or templates and keep the
                  majority of every sale.
                </p>
              )}
              <Link href="/account/seller" className="btn btn-secondary btn-sm">
                {user.sellerProfile ? "Manage store" : "Apply to sell"}
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="border-critical/25">
        <CardHeader
          title="Close account"
          description="Revokes access immediately. Financial records are retained by law."
        />
        <CardBody>
          <DeleteAccountForm action={deleteAccountAction} />
        </CardBody>
      </Card>
    </div>
  );
}
