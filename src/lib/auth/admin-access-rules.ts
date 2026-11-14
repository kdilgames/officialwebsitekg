/**
 * Pure email-based owner & admin access policy helpers.
 *
 * No database or Next.js imports live here so the policy rules can be verified
 * directly with unit tests and shared safely across auth and admin layers.
 */

export const DEFAULT_OWNER_EMAIL = "kdilgames@gmail.com";
export const ADMIN_ALLOWLIST_SETTING_KEY = "admin_allowlist_emails";

export function normalizeEmail(email: string | null | undefined): string {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

export function resolveOwnerEmail(configuredOwnerEmail?: string | null): string {
  const normalized = normalizeEmail(configuredOwnerEmail);
  return normalized.includes("@") ? normalized : DEFAULT_OWNER_EMAIL;
}

export function isOwnerEmail(
  email: string | null | undefined,
  configuredOwnerEmail?: string | null,
): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return normalized === resolveOwnerEmail(configuredOwnerEmail);
}

/**
 * Accepts a JSON array (`["a@example.com"]`), an object with `{ emails: [...] }`,
 * or a comma/whitespace-separated string from `SiteSetting`.
 */
export function parseAdminAllowlist(value: unknown): string[] {
  let rawEntries: unknown[] = [];

  if (Array.isArray(value)) {
    rawEntries = value;
  } else if (typeof value === "string") {
    rawEntries = value.split(/[\s,;]+/);
  } else if (value && typeof value === "object" && "emails" in value) {
    const nested = (value as { emails?: unknown }).emails;
    if (Array.isArray(nested)) rawEntries = nested;
  }

  const normalized = rawEntries
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => normalizeEmail(entry))
    .filter((entry) => entry.length > 3 && entry.includes("@"));

  return [...new Set(normalized)];
}

export function resolveAdminEmailSet(params: {
  ownerEmail?: string | null;
  envAdminEmails?: readonly string[];
  settingAllowlist?: unknown;
}): Set<string> {
  const set = new Set<string>();
  set.add(resolveOwnerEmail(params.ownerEmail));

  for (const email of params.envAdminEmails ?? []) {
    const normalized = normalizeEmail(email);
    if (normalized.includes("@")) set.add(normalized);
  }

  for (const email of parseAdminAllowlist(params.settingAllowlist)) {
    set.add(email);
  }

  return set;
}

export function isEmailAllowlistedAdmin(
  email: string | null | undefined,
  allowedSet: ReadonlySet<string>,
): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return allowedSet.has(normalized);
}

export type AdminPromotionEvaluation = {
  shouldPromote: boolean;
  reason: "owner" | "allowlist" | null;
  isOwner: boolean;
  isConfiguredAdminEmail: boolean;
};

/**
 * Determines whether a signed-in user qualifies for automatic `ADMIN` elevation.
 *
 * Security invariant: `emailVerified` MUST be `true` before any email-based
 * elevation is permitted, preventing unverified signups from hijacking the owner
 * or allowlisted staff addresses.
 */
export function evaluateAdminPromotion(params: {
  email: string | null | undefined;
  emailVerified: boolean;
  currentRole: "USER" | "SELLER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  ownerEmail?: string | null;
  envAdminEmails?: readonly string[];
  settingAllowlist?: unknown;
}): AdminPromotionEvaluation {
  const owner = resolveOwnerEmail(params.ownerEmail);
  const normalized = normalizeEmail(params.email);
  const isOwner = normalized.length > 0 && normalized === owner;
  const allowedSet = resolveAdminEmailSet({
    ownerEmail: owner,
    envAdminEmails: params.envAdminEmails,
    settingAllowlist: params.settingAllowlist,
  });
  const isConfiguredAdminEmail = isEmailAllowlistedAdmin(normalized, allowedSet);

  if (params.status !== "ACTIVE" || !params.emailVerified || !isConfiguredAdminEmail) {
    return {
      shouldPromote: false,
      reason: null,
      isOwner,
      isConfiguredAdminEmail,
    };
  }

  if (params.currentRole === "ADMIN") {
    return {
      shouldPromote: false,
      reason: null,
      isOwner,
      isConfiguredAdminEmail,
    };
  }

  return {
    shouldPromote: true,
    reason: isOwner ? "owner" : "allowlist",
    isOwner,
    isConfiguredAdminEmail,
  };
}

export function canModifyAdminAccount(params: {
  actorId: string;
  targetId: string;
  targetEmail: string;
  targetRole: string;
  nextRole: string;
  activeAdminCount: number;
  ownerEmail?: string | null;
}): { allowed: boolean; reason?: string } {
  if (params.nextRole !== "ADMIN" && isOwnerEmail(params.targetEmail, params.ownerEmail)) {
    return {
      allowed: false,
      reason: "The primary owner account is protected and cannot be demoted.",
    };
  }

  if (params.actorId === params.targetId && params.nextRole !== "ADMIN") {
    return {
      allowed: false,
      reason: "You cannot demote your own administrator account.",
    };
  }

  if (params.targetRole === "ADMIN" && params.nextRole !== "ADMIN" && params.activeAdminCount <= 1) {
    return {
      allowed: false,
      reason: "The last active administrator cannot be demoted.",
    };
  }

  return { allowed: true };
}

export function canSuspendAccount(params: {
  actorId: string;
  targetId: string;
  targetEmail: string;
  targetRole: string;
  ownerEmail?: string | null;
}): { allowed: boolean; reason?: string } {
  if (params.actorId === params.targetId) {
    return { allowed: false, reason: "You cannot suspend your own account." };
  }

  if (isOwnerEmail(params.targetEmail, params.ownerEmail)) {
    return { allowed: false, reason: "The primary owner account cannot be suspended." };
  }

  if (params.targetRole === "ADMIN") {
    return { allowed: false, reason: "Administrator accounts cannot be suspended directly." };
  }

  return { allowed: true };
}
