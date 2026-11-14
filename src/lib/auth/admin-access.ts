import type { SellerProfile, User } from "@prisma/client";
import type { User as AuthUser } from "@supabase/supabase-js";

import { notify, recordAudit } from "@/lib/audit";
import {
  ADMIN_ALLOWLIST_SETTING_KEY,
  evaluateAdminPromotion,
  isEmailAllowlistedAdmin,
  normalizeEmail,
  parseAdminAllowlist,
  resolveAdminEmailSet,
  resolveOwnerEmail,
} from "@/lib/auth/admin-access-rules";
import { prisma } from "@/lib/db";
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

export async function provisionMarketplaceUser(authUser: AuthUser): Promise<AuthSessionUser | null> {
  const email = normalizeEmail(authUser.email);
  if (!email) return null;

  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const base =
    typeof meta.username === "string" && meta.username.trim().length >= 3
      ? meta.username
      : (email.split("@")[0] ?? "user");

  const username = await uniqueUsername(base);
  const displayName =
    typeof meta.display_name === "string" && meta.display_name.trim().length > 0
      ? meta.display_name.trim()
      : username;

  return prisma.user.upsert({
    where: { authUserId: authUser.id },
    update: {},
    create: {
      authUserId: authUser.id,
      username,
      displayName,
      email,
      emailVerified: Boolean(authUser.email_confirmed_at),
      termsAcceptedAt: meta.terms_version ? new Date() : null,
      termsVersion: typeof meta.terms_version === "string" ? meta.terms_version : null,
    },
    include: { sellerProfile: true },
  });
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
    user = await provisionMarketplaceUser(authUser);
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

  if (needsUpdate) {
    const previousRole = user.role;
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

    if (shouldPromote) {
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
    promoted: shouldPromote,
    promotionReason,
  };
}
