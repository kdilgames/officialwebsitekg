"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/auth/server";
import { isConfiguredStaffEmail, syncAuthenticatedUser } from "@/lib/auth/admin-access";
import { prisma } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstileFromFormData } from "@/lib/turnstile";
import { getRequestContext, recordAudit } from "@/lib/audit";
import { getRequestOrigin } from "@/lib/utils/origin";
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
  magicLinkSchema,
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
  return getRequestOrigin();
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
  const turnstile = await verifyTurnstileFromFormData(formData, context.ipAddress);
  if (!turnstile.ok) {
    return errorState(turnstile.message ?? "Verification failed. Please try again.");
  }

  const limit = await rateLimit(
    `signup:${context.ipAddress ?? "unknown"}`,
    5,
    60 * 60,
  );
  if (!limit.ok) {
    return errorState("Too many sign-up attempts from this network. Try again later.");
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: data.email, mode: "insensitive" } },
        { username: data.username.toLowerCase() },
      ],
    },
    select: { email: true, username: true },
  });
  if (existing) {
    const emailTaken = existing.email.toLowerCase() === data.email.toLowerCase();
    return errorState("That account already exists.", {
      [emailTaken ? "email" : "username"]: emailTaken
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
  const turnstile = await verifyTurnstileFromFormData(formData, context.ipAddress);
  if (!turnstile.ok) {
    return errorState(turnstile.message ?? "Verification failed. Please try again.");
  }

  const limit = await rateLimit(`signin:${context.ipAddress ?? "unknown"}:${parsed.data.email}`, 10, 15 * 60);
  if (!limit.ok) {
    return errorState("Too many sign-in attempts. Wait a few minutes and try again.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return errorState("Invalid email or password.");
  }

  const synced = await syncAuthenticatedUser(data.user, { updateLastLogin: true });

  if (!synced.user) {
    await supabase.auth.signOut();
    if (synced.accountStatus === "SUSPENDED") {
      return errorState("This account is suspended. Contact support for help.");
    }
    return errorState("This account is unavailable. Contact support.");
  }

  await recordAudit({
    actorId: synced.user.id,
    actorRole: synced.user.role,
    action: "auth.sign_in",
    entityType: "User",
    entityId: synced.user.id,
  });

  const next = String(formData.get("next") ?? "").trim();
  const fallback = synced.user.role === "ADMIN" ? "/admin" : "/account";
  redirect(next ? safeNext(next, fallback) : fallback);
}

export async function sendMagicLinkAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured) return notConfigured();

  const parsed = magicLinkSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please enter a valid email address.", toFieldErrors(parsed.error.issues));
  }

  const context = await getRequestContext();
  const turnstile = await verifyTurnstileFromFormData(formData, context.ipAddress);
  if (!turnstile.ok) {
    return errorState(turnstile.message ?? "Verification failed. Please try again.");
  }

  const [ipLimit, emailLimit] = await Promise.all([
    rateLimit(`magiclink-ip:${context.ipAddress ?? "unknown"}`, 8, 15 * 60),
    rateLimit(`magiclink-email:${parsed.data.email}`, 4, 15 * 60),
  ]);

  if (!ipLimit.ok || !emailLimit.ok) {
    return errorState("Too many link requests. Wait a few minutes before requesting another email.");
  }

  const supabase = await createSupabaseServerClient();
  const baseUrl = await authRedirectBaseUrl();
  const nextRaw = String(formData.get("next") ?? "").trim();
  const redirectTarget = nextRaw
    ? `${baseUrl}/auth/callback?next=${encodeURIComponent(safeNext(nextRaw))}`
    : `${baseUrl}/auth/callback`;

  const isStaffEmail = await isConfiguredStaffEmail(parsed.data.email);
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: redirectTarget,
      shouldCreateUser: isStaffEmail,
    },
  });

  if (error) {
    if (/rate limit|security purposes|too many/i.test(error.message)) {
      return errorState("Please wait a minute before requesting another email link.");
    }
    if (!/signup|not allowed/i.test(error.message)) {
      return errorState(error.message);
    }
  }

  return successState(
    "If that email is registered or authorized as staff, a one-click sign-in link has been sent. Check your inbox.",
  );
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
  const turnstile = await verifyTurnstileFromFormData(formData, context.ipAddress);
  if (!turnstile.ok) {
    return errorState(turnstile.message ?? "Verification failed. Please try again.");
  }

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
