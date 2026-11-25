import type { SellerProfile, User } from "@prisma/client";
import type { User as AuthUser } from "@supabase/supabase-js";

import { notify, recordAudit } from "@/lib/audit";
import {
  ADMIN_ALLOWLIST_SETTING_KEY,
  evaluateAdminPromotion,
  evaluateExistingEmailRelink,
  isEmailAllowlistedAdmin,
  normalizeEmail,
  parseAdminAllowlist,
  resolveAdminEmailSet,
  resolveOwnerEmail,
} from "@/lib/auth/admin-access-rules";
import { prisma } from "@/lib/db";
import { isUniqueConstraintError } from "@/lib/db-compat";
import { env } from "@/lib/env";

export type AuthSessionUser = User & { sellerProfile: SellerProfile | null };

export async function getAllowlistedEmailsFromSettings(): Promise<string[]> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: ADMIN_ALLOWLIST_SETTING_KEY },
      select: { value: true },
    });
    return parseAdminAllowlist(setting?.value);
  } catch {
    return [];
  }
}

export async function getConfiguredAdminEmails() {
  const ownerEmail = resolveOwnerEmail(env.auth.ownerEmail);
  const envAdminEmails = env.auth.adminEmails;
  const settingEmails = await getAllowlistedEmailsFromSettings();
  const combined = resolveAdminEmailSet({
    ownerEmail,
    envAdminEmails,
    settingAllowlist: settingEmails,
  });

  return {
    ownerEmail,
    envAdminEmails,
    settingEmails,
    combined,
  };
}

export async function isConfiguredStaffEmail(email: string | null | undefined): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const ownerEmail = resolveOwnerEmail(env.auth.ownerEmail);
  if (normalized === ownerEmail) return true;
  if (env.auth.adminEmails.includes(normalized)) return true;

  const settingEmails = await getAllowlistedEmailsFromSettings();
  const combined = resolveAdminEmailSet({
    ownerEmail,
    envAdminEmails: env.auth.adminEmails,
    settingAllowlist: settingEmails,
  });
  return isEmailAllowlistedAdmin(normalized, combined);
}

export async function uniqueUsername(raw: string): Promise<string> {
  const base = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "user";
  const seed = base.length >= 3 ? base : `user${base}`;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? seed : `${seed.slice(0, 20)}${attempt}`;
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `${seed.slice(0, 16)}${Date.now().toString(36)}`;
}

async function findOrRelinkUserByEmail(params: {
  authUserId: string;
  email: string;
  emailVerified: boolean;
}): Promise<AuthSessionUser | null | undefined> {
  const existingByEmail = await prisma.user.findFirst({
    where: { email: { equals: params.email, mode: "insensitive" } },
    include: { sellerProfile: true },
  });
  if (!existingByEmail) return undefined;

  const decision = evaluateExistingEmailRelink({
    emailVerified: params.emailVerified,
    existingStatus: existingByEmail.status,
  });

  if (decision.action === "block") {
    // Return suspended/deleted account without relinking so syncAuthenticatedUser
    // blocks access consistently instead of creating duplicates or raising P2002.
    return existingByEmail;
  }

  if (decision.action === "reject_unverified") {
    return null;
  }

  const previousAuthUserId = existingByEmail.authUserId;
  try {
    const updated = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        authUserId: params.authUserId,
        email: params.email,
        ...(params.emailVerified && !existingByEmail.emailVerified ? { emailVerified: true } : {}),
      },
      include: { sellerProfile: true },
    });

    await recordAudit({
      actorId: updated.id,
      actorRole: updated.role,
      action: "auth.user_relinked",
      entityType: "User",
      entityId: updated.id,
      before: { authUserId: previousAuthUserId },
      after: { authUserId: params.authUserId, email: params.email },
    }).catch(() => undefined);

    return updated;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const raced = await prisma.user.findUnique({
        where: { authUserId: params.authUserId },
        include: { sellerProfile: true },
      });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function provisionMarketplaceUser(
  authUser: AuthUser,
  options?: { markEmailVerified?: boolean },
): Promise<AuthSessionUser | null> {
  const email = normalizeEmail(authUser.email);
  if (!email) return null;

  const existingByAuth = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    include: { sellerProfile: true },
  });
  if (existingByAuth) return existingByAuth;

  const isAuthConfirmed = Boolean(authUser.email_confirmed_at) || Boolean(options?.markEmailVerified);

  const relinked = await findOrRelinkUserByEmail({
    authUserId: authUser.id,
    email,
    emailVerified: isAuthConfirmed,
  });
  if (relinked !== undefined) return relinked;

  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const base =
    typeof meta.username === "string" && meta.username.trim().length >= 3
      ? meta.username
      : (email.split("@")[0] ?? "user");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidateSeed =
      attempt === 0 ? base : `${base.slice(0, 16)}_${Math.random().toString(36).slice(2, 6)}`;
    const username = await uniqueUsername(candidateSeed);
    const displayName =
      typeof meta.display_name === "string" && meta.display_name.trim().length > 0
        ? meta.display_name.trim()
        : username;

    try {
      return await prisma.user.create({
        data: {
          authUserId: authUser.id,
          username,
          displayName,
          email,
          emailVerified: isAuthConfirmed,
          termsAcceptedAt: meta.terms_version ? new Date() : null,
          termsVersion: typeof meta.terms_version === "string" ? meta.terms_version : null,
        },
        include: { sellerProfile: true },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      const byAuth = await prisma.user.findUnique({
        where: { authUserId: authUser.id },
        include: { sellerProfile: true },
      });
      if (byAuth) return byAuth;

      const emailMatch = await findOrRelinkUserByEmail({
        authUserId: authUser.id,
        email,
        emailVerified: isAuthConfirmed,
      });
      if (emailMatch !== undefined) return emailMatch;
    }
  }

  return null;
}

export type SyncAuthenticatedUserResult = {
  user: AuthSessionUser | null;
  accountStatus: User["status"] | null;
  promoted: boolean;
  promotionReason: "owner" | "allowlist" | null;
};

/**
 * Ensures the signed-in Supabase Auth user has a synced `User` record, refreshes
 * verified email state, and automatically grants `ADMIN` when the verified email
 * matches the platform owner (`ADMIN_OWNER_EMAIL`) or an allowlisted admin email.
 */
export async function syncAuthenticatedUser(
  authUser: AuthUser,
  options?: {
    markEmailVerified?: boolean;
    updateLastLogin?: boolean;
  },
): Promise<SyncAuthenticatedUserResult> {
  let user = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    include: { sellerProfile: true },
  });

  if (!user) {
    user = await provisionMarketplaceUser(authUser, options);
  }

  if (!user) {
    return { user: null, accountStatus: null, promoted: false, promotionReason: null };
  }

  if (user.status === "SUSPENDED" || user.status === "DELETED") {
    return {
      user: null,
      accountStatus: user.status,
      promoted: false,
      promotionReason: null,
    };
  }

  const authEmail = normalizeEmail(authUser.email);
  const storedEmail = normalizeEmail(user.email);
  const targetEmail = authEmail || storedEmail;
  const emailChanged = Boolean(authEmail) && storedEmail !== authEmail;

  const isAuthConfirmed =
    Boolean(authUser.email_confirmed_at) || Boolean(options?.markEmailVerified);
  const effectiveEmailVerified = user.emailVerified || isAuthConfirmed;

  let shouldPromote = false;
  let promotionReason: "owner" | "allowlist" | null = null;

  if (effectiveEmailVerified && user.role !== "ADMIN") {
    const settingAllowlist = await getAllowlistedEmailsFromSettings();
    const evaluation = evaluateAdminPromotion({
      email: targetEmail,
      emailVerified: effectiveEmailVerified,
      currentRole: user.role,
      status: user.status,
      ownerEmail: env.auth.ownerEmail,
      envAdminEmails: env.auth.adminEmails,
      settingAllowlist,
    });
    shouldPromote = evaluation.shouldPromote;
    promotionReason = evaluation.reason;
  }

  const needsVerifiedSync = !user.emailVerified && effectiveEmailVerified;
  const needsUpdate =
    emailChanged || needsVerifiedSync || shouldPromote || Boolean(options?.updateLastLogin);

  let appliedPromotion = shouldPromote;

  if (needsUpdate) {
    const previousRole = user.role;
    try {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(emailChanged ? { email: authEmail } : {}),
          ...(needsVerifiedSync ? { emailVerified: true } : {}),
          ...(shouldPromote ? { role: "ADMIN" } : {}),
          ...(options?.updateLastLogin ? { lastLoginAt: new Date() } : {}),
        },
        include: { sellerProfile: true },
      });
    } catch (error) {
      if (!emailChanged || !isUniqueConstraintError(error)) {
        throw error;
      }

      appliedPromotion = false;
      const fallbackNeedsUpdate = needsVerifiedSync || Boolean(options?.updateLastLogin);
      if (fallbackNeedsUpdate) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(needsVerifiedSync ? { emailVerified: true } : {}),
            ...(options?.updateLastLogin ? { lastLoginAt: new Date() } : {}),
          },
          include: { sellerProfile: true },
        });
      }
    }

    if (appliedPromotion) {
      await recordAudit({
        actorId: user.id,
        actorRole: "ADMIN",
        action: "auth.admin_auto_promoted",
        entityType: "User",
        entityId: user.id,
        before: { role: previousRole },
        after: { role: "ADMIN", email: targetEmail, reason: promotionReason },
      }).catch(() => undefined);

      await notify({
        userId: user.id,
        type: "SYSTEM",
        title: "Administrator access activated",
        body:
          promotionReason === "owner"
            ? `Your verified owner email (${targetEmail}) now has full platform administration access.`
            : `Your verified email (${targetEmail}) matched the platform admin allowlist.`,
        href: "/admin",
      }).catch(() => undefined);
    }
  }

  return {
    user,
    accountStatus: user.status,
    promoted: appliedPromotion,
    promotionReason: appliedPromotion ? promotionReason : null,
  };
}
