import { redirect } from "next/navigation";
import type { User as AuthUser } from "@supabase/supabase-js";

import type { SellerProfile } from "@prisma/client";

import {
  syncAuthenticatedUser,
  uniqueUsername as generateUniqueUsername,
  type AuthSessionUser,
} from "@/lib/auth/admin-access";
import { isOwnerEmail } from "@/lib/auth/admin-access-rules";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { env, isSupabaseConfigured } from "@/lib/env";

export type SessionUser = AuthSessionUser;

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
  const result = await syncAuthenticatedUser(authUser);
  return result.user;
}

export async function uniqueUsername(raw: string): Promise<string> {
  return generateUniqueUsername(raw);
}

/** Redirects to the sign-in page when there is no valid session. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return user;
}

export async function requireAdmin(returnTo = "/admin"): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (user.role !== "ADMIN") {
    if (!user.emailVerified && isOwnerEmail(user.email, env.auth.ownerEmail)) {
      redirect("/account");
    }
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

export function isOwner(user: SessionUser | null): boolean {
  return Boolean(user && isOwnerEmail(user.email, env.auth.ownerEmail));
}

