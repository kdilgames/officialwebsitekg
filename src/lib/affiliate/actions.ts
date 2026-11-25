"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { errorState, successState, type ActionState } from "@/lib/action-state";
import {
  AFFILIATE_COOKIE_NAME,
  computeAffiliateCommissionMinor,
  DEFAULT_AFFILIATE_COMMISSION_BPS,
  normalizeAffiliateCode,
} from "@/lib/affiliate/rules";
import { notify, recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isMissingSchemaError, isUniqueConstraintError, withSchemaFallback } from "@/lib/db-compat";
import { rateLimit } from "@/lib/rate-limit";

/** Creates or updates the signed-in user's affiliate referral code. */
export async function saveAffiliateCodeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/account/affiliate");
  const rawCode = String(formData.get("code") ?? "");
  const code = normalizeAffiliateCode(rawCode);
  if (!code) {
    return errorState("Use 3–24 letters, numbers, hyphens, or underscores.", {
      code: "Code must be 3–24 alphanumeric characters (A-Z, 0-9, _, -).",
    });
  }

  const rl = await rateLimit(`affiliate-save:${user.id}`, 10, 60 * 60);
  if (!rl.ok) {
    return errorState("Too many code updates recently. Please try again later.");
  }

  try {
    const existing = await prisma.affiliateAccount.findUnique({
      where: { userId: user.id },
      select: { id: true, code: true },
    });

    if (existing) {
      await prisma.affiliateAccount.update({
        where: { id: existing.id },
        data: { code, isActive: true },
      });
    } else {
      await prisma.affiliateAccount.create({
        data: {
          userId: user.id,
          code,
          commissionBps: DEFAULT_AFFILIATE_COMMISSION_BPS,
        },
      });
    }

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: existing ? "affiliate.updated" : "affiliate.enrolled",
      entityType: "AffiliateAccount",
      entityId: user.id,
      after: { code },
    }).catch(() => undefined);

    revalidatePath("/account/affiliate");
    return successState(`Affiliate referral code "${code}" is active!`);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return errorState("That referral code is already taken. Choose another one.", {
        code: "Already taken.",
      });
    }
    if (isMissingSchemaError(error)) {
      return errorState(
        "Affiliate database tables are pending migration. Please try again after deployment completes.",
      );
    }
    throw error;
  }
}

/**
 * Attributes a newly created order to a referring affiliate cookie (`kdil-ref`)
 * when present, or credits the affiliate once a paid order settles.
 * Self-referrals are strictly ignored. Safe pre-migration.
 */
export async function readAffiliateCookieCode(): Promise<string | null> {
  try {
    const store = await cookies();
    const raw = store.get(AFFILIATE_COOKIE_NAME)?.value;
    return raw ? normalizeAffiliateCode(raw) : null;
  } catch {
    return null;
  }
}

export async function creditAffiliateForPaidOrder(params: {
  orderId: string;
  buyerId: string;
  orderTotalMinor: number;
  platformFeeMinor: number;
  currency: string;
  affiliateCode?: string | null;
}): Promise<void> {
  const code = params.affiliateCode ?? (await readAffiliateCookieCode());
  if (!code || params.orderTotalMinor <= 0) return;

  await withSchemaFallback(async () => {
    const account = await prisma.affiliateAccount.findFirst({
      where: { code, isActive: true },
      select: { id: true, userId: true, commissionBps: true },
    });
    if (!account) return;
    // Block self-referrals.
    if (account.userId === params.buyerId) return;

    const existing = await prisma.affiliateReferral.findUnique({
      where: { orderId: params.orderId },
      select: { id: true },
    });
    if (existing) return;

    const commissionMinor = computeAffiliateCommissionMinor({
      orderTotalMinor: params.orderTotalMinor,
      platformFeeMinor: params.platformFeeMinor,
      commissionBps: account.commissionBps,
    });
    if (commissionMinor <= 0) return;

    await prisma.$transaction([
      prisma.affiliateReferral.create({
        data: {
          affiliateId: account.id,
          orderId: params.orderId,
          commissionMinor,
          currency: params.currency,
          status: "APPROVED",
        },
      }),
      prisma.affiliateAccount.update({
        where: { id: account.id },
        data: {
          conversions: { increment: 1 },
          earnedMinor: { increment: commissionMinor },
        },
      }),
    ]);

    await notify({
      userId: account.userId,
      type: "ORDER",
      title: "New affiliate conversion!",
      body: `Someone completed a purchase using your referral link (${code}).`,
      href: "/account/affiliate",
    }).catch(() => undefined);
  }, undefined);
}
