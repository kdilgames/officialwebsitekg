"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  errorState,
  formToObject,
  successState,
  toFieldErrors,
  type ActionState,
} from "@/lib/action-state";
import { getRequestContext, notify, recordAudit } from "@/lib/audit";
import { getSessionUser, requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isMissingSchemaError } from "@/lib/db-compat";
import {
  dmcaNoticeSchema,
  extractProductSlugFromUrl,
  generateDmcaNoticeNumber,
} from "@/lib/legal/dmca";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstileFromFormData } from "@/lib/turnstile";

export async function submitDmcaNoticeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = dmcaNoticeSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState(
      "Please complete all required copyright notice fields.",
      toFieldErrors(parsed.error.issues),
    );
  }

  const context = await getRequestContext();
  const turnstile = await verifyTurnstileFromFormData(formData, context.ipAddress);
  if (!turnstile.ok) {
    return errorState(turnstile.message ?? "Human verification failed. Please try again.");
  }

  const limit = await rateLimit(`dmca:${context.ipAddress ?? "unknown"}`, 5, 60 * 60);
  if (!limit.ok) {
    return errorState("Too many DMCA notices submitted from this network. Try again later.");
  }

  const data = parsed.data;
  const slug = extractProductSlugFromUrl(data.productUrl);
  const matchedProduct = slug
    ? await prisma.product.findUnique({
        where: { slug },
        select: { id: true, title: true },
      })
    : null;

  const noticeNumber = generateDmcaNoticeNumber();
  const sessionUser = await getSessionUser();

  try {
    const notice = await prisma.dmcaNotice.create({
      data: {
        noticeNumber,
        claimantName: data.claimantName,
        claimantEmail: data.claimantEmail,
        claimantCompany: data.claimantCompany || null,
        productId: matchedProduct?.id ?? null,
        productUrl: data.productUrl,
        originalWorkUrl: data.originalWorkUrl,
        description: data.description,
        goodFaithStatement: true,
        accuracyStatement: true,
        signature: data.signature,
        ipAddress: context.ipAddress,
      },
      select: { id: true, noticeNumber: true },
    });

    await recordAudit({
      actorId: sessionUser?.id ?? null,
      actorRole: sessionUser?.role ?? null,
      action: "dmca.submitted",
      entityType: "DmcaNotice",
      entityId: notice.id,
      after: { noticeNumber: notice.noticeNumber, productUrl: data.productUrl },
    }).catch(() => undefined);
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      throw error;
    }
    // Pre-migration graceful fallback: persist the notice as a high-priority Report
    // so legal takedown requests are never dropped before `db:deploy`.
    await prisma.report.create({
      data: {
        reporterId: sessionUser?.id ?? null,
        targetType: "PRODUCT",
        targetId: matchedProduct?.id ?? "00000000-0000-0000-0000-000000000000",
        reason: `[DMCA ${noticeNumber}] Copyright takedown notice`,
        details: [
          `Claimant: ${data.claimantName} <${data.claimantEmail}>`,
          data.claimantCompany ? `Company: ${data.claimantCompany}` : null,
          `Infringing URL: ${data.productUrl}`,
          `Original Work: ${data.originalWorkUrl}`,
          `Signature: ${data.signature}`,
          "",
          data.description,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  for (const admin of admins) {
    await notify({
      userId: admin.id,
      type: "SYSTEM",
      title: `DMCA notice ${noticeNumber}`,
      body: `${data.claimantName} filed a copyright notice for ${matchedProduct?.title ?? data.productUrl}.`,
      href: "/admin/dmca",
    }).catch(() => undefined);
  }

  return successState(
    `DMCA notice ${noticeNumber} received. Our compliance team will review it promptly and reply to ${data.claimantEmail}.`,
  );
}

const resolveDmcaSchema = z.object({
  noticeId: z.string().uuid(),
  status: z.enum(["UNDER_REVIEW", "REMOVED", "DISMISSED", "COUNTER_NOTICED"]),
  adminNotes: z.string().trim().max(2000).optional(),
  suspendProduct: z.string().optional(),
});

export async function resolveDmcaNoticeAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = resolveDmcaSchema.safeParse(formToObject(formData));
  if (!parsed.success) return;

  const { noticeId, status, adminNotes, suspendProduct } = parsed.data;

  const notice = await prisma.dmcaNotice.findUnique({
    where: { id: noticeId },
    include: {
      product: {
        select: { id: true, title: true, slug: true, seller: { select: { userId: true } } },
      },
    },
  });
  if (!notice) return;

  const isFinal = status === "REMOVED" || status === "DISMISSED";

  await prisma.dmcaNotice.update({
    where: { id: notice.id },
    data: {
      status,
      adminNotes: adminNotes || null,
      reviewedById: admin.id,
      resolvedAt: isFinal ? new Date() : null,
    },
  });

  if (status === "REMOVED" && suspendProduct === "true" && notice.product) {
    await prisma.product.update({
      where: { id: notice.product.id },
      data: {
        status: "SUSPENDED",
        rejectionReason: `Suspended following DMCA notice ${notice.noticeNumber}.`,
      },
    });
    await notify({
      userId: notice.product.seller.userId,
      type: "MODERATION",
      title: `Listing suspended (${notice.noticeNumber})`,
      body: `“${notice.product.title}” was suspended pending a DMCA copyright notice. Contact support to submit a counter-notice.`,
      href: "/support/new",
    }).catch(() => undefined);
  }

  await recordAudit({
    actorId: admin.id,
    actorRole: admin.role,
    action: "dmca.updated",
    entityType: "DmcaNotice",
    entityId: notice.id,
    after: { status, suspendedProduct: status === "REMOVED" && suspendProduct === "true" },
  });

  revalidatePath("/admin/dmca");
  revalidatePath("/admin");
  if (notice.product) {
    revalidatePath(`/product/${notice.product.slug}`);
  }
}
