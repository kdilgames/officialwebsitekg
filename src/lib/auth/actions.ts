"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createSupabaseServerClient } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { env, isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestContext, recordAudit } from "@/lib/audit";
import {
  type ActionState,
  errorState,
  formToObject,
  successState,
  toFieldErrors,
} from "@/lib/action-state";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  TERMS_VERSION,
} from "@/lib/validation";
import { safeNext } from "@/lib/utils/next";

function notConfigured(): ActionState {
  return errorState(
    "Accounts are unavailable: Supabase Auth is not configured for this deployment yet.",
  );
}

async function authRedirectBaseUrl(): Promise<string> {
  const headerList = await headers();
  const proto =
    headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (env.siteUrl.startsWith("https://") ? "https" : "http");
  const host =
    headerList.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headerList.get("host")?.trim();

  if (!host) return env.siteUrl;
  return `${proto}://${host}`;
}

export async function signUpAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured) return notConfigured();

  const parsed = registerSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  const data = parsed.data;

  const context = await getRequestContext();
  const limit = await rateLimit(
    `signup:${context.ipAddress ?? "unknown"}`,
    5,
    60 * 60,
  );
  if (!limit.ok) {
    return errorState("Too many sign-up attempts from this network. Try again later.");
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { username: data.username.toLowerCase() }] },
    select: { email: true, username: true },
  });
  if (existing) {
    return errorState("That account already exists.", {
      [existing.email === data.email ? "email" : "username"]:
        existing.email === data.email
          ? "An account with this email already exists."
          : "This username is taken.",
    });
  }

  const supabase = await createSupabaseServerClient();
  const baseUrl = await authRedirectBaseUrl();
  const { data: created, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback?next=/account`,
      data: {
        username: data.username.toLowerCase(),
        display_name: data.displayName,
        country: data.country ?? null,
        marketing_opt_in: data.marketingOptIn,
        terms_version: TERMS_VERSION,
      },
    },
  });

  if (error) {
    return errorState(error.message);
  }

  // Supabase returns an empty identities array when the email is already taken
  // but confirming that would leak account existence, so a generic success is
  // returned and the sign-in flow handles the rest.
  if (created.user) {
    await prisma.user
      .update({
        where: { authUserId: created.user.id },
        data: {
          marketingOptIn: data.marketingOptIn,
          country: data.country ?? null,
          privacyAcceptedAt: new Date(),
        },
      })
      .catch(() => undefined);
  }

  return successState(
    "Account created. Check your inbox for the verification link, then sign in.",
  );
}

export async function signInAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured) return notConfigured();

  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  const context = await getRequestContext();
  const limit = await rateLimit(`signin:${context.ipAddress ?? "unknown"}:${parsed.data.email}`, 10, 15 * 60);
  if (!limit.ok) {
    return errorState("Too many sign-in attempts. Wait a few minutes and try again.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return errorState("Invalid email or password.");
  }

  const user = await prisma.user.findUnique({
    where: { authUserId: data.user.id },
    select: { id: true, status: true, role: true, sellerProfile: { select: { status: true } } },
  });

  if (!user) {
    await supabase.auth.signOut();
    return errorState("This account is not linked to a marketplace profile. Contact support.");
  }

  if (user.status !== "ACTIVE") {
    await supabase.auth.signOut();
    return errorState("This account is suspended. Contact support for help.");
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "auth.sign_in",
    entityType: "User",
    entityId: user.id,
  });

  const next = String(formData.get("next") ?? "").trim();
  redirect(safeNext(next));
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordResetAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured) return notConfigured();

  const parsed = forgotPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  const context = await getRequestContext();
  const limit = await rateLimit(`pwreset:${context.ipAddress ?? "unknown"}`, 5, 60 * 60);
  if (!limit.ok) {
    return errorState("Too many reset requests. Try again later.");
  }

  const supabase = await createSupabaseServerClient();
  const baseUrl = await authRedirectBaseUrl();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${baseUrl}/auth/callback?next=/account/password`,
  });

  // Always the same response so the form cannot be used to enumerate accounts.
  return successState("If that email has an account, a reset link is on its way.");
}

export async function changePasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured) return notConfigured();

  const parsed = changePasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return errorState("Your session expired. Sign in again.");

  // Verify the current password before changing it.
  const check = await supabase.auth.signInWithPassword({
    email: auth.user.email,
    password: parsed.data.currentPassword,
  });
  if (check.error) {
    return errorState("Current password is incorrect.", { currentPassword: "Incorrect password." });
  }

  const limit = await rateLimit(`pwchange:${auth.user.id}`, 10, 60 * 60);
  if (!limit.ok) return errorState("Too many attempts. Try again later.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return errorState(error.message);

  return successState("Password updated.");
}

/**
 * Completes a password reset. The reset link signs the user in through
 * `/auth/callback`, so the session already exists and the new password is set
 * against it — no password is ever accepted from an unauthenticated request.
 */
export async function resetPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured) return notConfigured();

  const parsed = resetPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return errorState("This reset link has expired. Request a new one from the sign-in page.");
  }

  const limit = await rateLimit(`pwreset-apply:${auth.user.id}`, 10, 60 * 60);
  if (!limit.ok) return errorState("Too many attempts. Try again later.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return errorState(error.message);

  return successState("Your password has been changed. You can keep using this session.");
}
