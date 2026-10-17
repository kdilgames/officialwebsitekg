import { redirect } from "next/navigation";
import type { User as AuthUser } from "@supabase/supabase-js";

import type { SellerProfile, User } from "@prisma/client";

import { createSupabaseServerClient } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";

export type SessionUser = User & { sellerProfile: SellerProfile | null };

/**
 * Returns the signed-in marketplace user, or null.
 *
 * `auth.getUser()` verifies the JWT with Supabase Auth on every call, so a
 * tampered cookie cannot promote a session. Suspended and soft-deleted accounts
 * lose access immediately even though their Auth session is still valid.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return loadUser(data.user);
}

async function loadUser(authUser: AuthUser): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    include: { sellerProfile: true },
  });

  // The database trigger creates this row on signup. If it is missing (for
  // example on a database restored without the trigger), provision it lazily
  // instead of locking the account out.
  if (!user) {
    return provisionUser(authUser);
  }

  if (user.status === "SUSPENDED" || user.status === "DELETED") return null;

  return user;
}

async function provisionUser(authUser: AuthUser): Promise<SessionUser | null> {
  const email = authUser.email;
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

  const created = await prisma.user.upsert({
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

  return created.status === "SUSPENDED" || created.status === "DELETED" ? null : created;
}

export async function uniqueUsername(raw: string): Promise<string> {
  const base = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "user";
  const seed = base.length >= 3 ? base : `user${base}`;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? seed : `${seed.slice(0, 20)}${attempt}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }

  return `${seed.slice(0, 16)}${Date.now().toString(36)}`;
}

/** Redirects to the sign-in page when there is no valid session. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") {
    redirect("/");
  }
  return user;
}

export type SellerContext = SessionUser & { sellerProfile: SellerProfile };

/**
 * Requires an approved seller. Pending or rejected applicants are sent to the
 * seller application page rather than being allowed into the dashboard.
 */
export async function requireSeller(): Promise<SellerContext> {
  const user = await requireUser("/dashboard");

  if (!user.sellerProfile || user.sellerProfile.status !== "APPROVED") {
    redirect("/account/seller");
  }

  return user as SellerContext;
}

export function isSeller(user: SessionUser | null): boolean {
  return user?.sellerProfile?.status === "APPROVED";
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === "ADMIN";
}
