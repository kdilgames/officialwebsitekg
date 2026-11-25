"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { requireSeller } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { generateLicenseKey } from "@/lib/licenses/keys";

/**
 * Ensures every paid item in an order has a unique software license key.
 * Safe to invoke repeatedly (idempotent) and pre-migration tolerant.
 */
export async function issueLicenseKeysForOrder(orderId: string): Promise<void> {
  await withSchemaFallback(async () => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        items: {
          where: { status: "PAID" },
          select: {
            id: true,
            productId: true,
            sellerId: true,
            licenseKey: { select: { id: true } },
          },
        },
      },
    });
    if (!order) return;

    for (const item of order.items) {
      if (item.licenseKey) continue;
      await prisma.licenseKey
        .create({
          data: {
            key: generateLicenseKey(),
            orderItemId: item.id,
            productId: item.productId,
            buyerId: order.buyerId,
            sellerId: item.sellerId,
          },
        })
        .catch(() => undefined);
    }
  }, undefined);
}

/** Seller action to revoke or re-activate a buyer license key for one of their products. */
export async function toggleLicenseKeyStatusAction(formData: FormData): Promise<void> {
  const user = await requireSeller();
  const licenseId = String(formData.get("licenseId") ?? "").trim();
  const nextStatus = String(formData.get("status") ?? "").trim();
  if (!licenseId || (nextStatus !== "ACTIVE" && nextStatus !== "REVOKED")) return;

  const existing = await withSchemaFallback(
    () =>
      prisma.licenseKey.findFirst({
        where: { id: licenseId, sellerId: user.sellerProfile.id },
        select: { id: true, status: true },
      }),
    null,
  );
  if (!existing) return;

  await prisma.licenseKey.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      revokedAt: nextStatus === "REVOKED" ? new Date() : null,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: nextStatus === "REVOKED" ? "license.revoked" : "license.reactivated",
    entityType: "LicenseKey",
    entityId: existing.id,
  }).catch(() => undefined);

  revalidatePath("/dashboard/licenses");
  revalidatePath("/account/orders");
}
