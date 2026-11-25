"use server";

import {
  errorState,
  formToObject,
  successState,
  toFieldErrors,
  type ActionState,
} from "@/lib/action-state";
import { getRequestContext } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { isMissingSchemaError } from "@/lib/db-compat";
import { sendEmail } from "@/lib/email/resend";
import { escapeHtml } from "@/lib/email/templates";
import { env } from "@/lib/env";
import {
  generateUnsubscribeToken,
  newsletterSubscribeSchema,
  normalizeNewsletterEmail,
} from "@/lib/newsletter/rules";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstileFromFormData } from "@/lib/turnstile";

async function syncResendAudienceContact(email: string): Promise<void> {
  const apiKey = env.email.resendApiKey;
  const audienceId = process.env.RESEND_AUDIENCE_ID?.trim();
  if (!apiKey || !audienceId) return;

  try {
    await fetch(`https://api.resend.com/audiences/${encodeURIComponent(audienceId)}/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, unsubscribed: false }),
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
  } catch (error) {
    console.warn("[newsletter] Resend audience sync failed:", error);
  }
}

export async function subscribeNewsletterAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = newsletterSubscribeSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please enter a valid email address.", toFieldErrors(parsed.error.issues));
  }

  const context = await getRequestContext();
  const turnstile = await verifyTurnstileFromFormData(formData, context.ipAddress);
  if (!turnstile.ok) {
    return errorState(turnstile.message ?? "Verification failed. Please try again.");
  }

  const rl = await rateLimit(`newsletter:${context.ipAddress ?? "unknown"}`, 8, 60 * 60);
  if (!rl.ok) {
    return errorState("Too many subscription attempts. Please try again later.");
  }

  const email = normalizeNewsletterEmail(parsed.data.email);
  const token = generateUnsubscribeToken();
  let unsubscribeToken = token;

  try {
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true, status: true, unsubscribeToken: true },
    });

    if (existing) {
      unsubscribeToken = existing.unsubscribeToken;
      if (existing.status === "SUBSCRIBED") {
        return successState("You are already subscribed to KDILGAMES updates!");
      }
      await prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: {
          status: "SUBSCRIBED",
          locale: parsed.data.locale,
          source: parsed.data.source,
          confirmedAt: new Date(),
        },
      });
    } else {
      await prisma.newsletterSubscriber.create({
        data: {
          email,
          locale: parsed.data.locale,
          source: parsed.data.source,
          status: "SUBSCRIBED",
          unsubscribeToken: token,
          confirmedAt: new Date(),
        },
      });
    }
  } catch (error) {
    if (isMissingSchemaError(error)) {
      // Pre-migration graceful fallback: still sync to Resend Audience if configured.
      await syncResendAudienceContact(email);
      return successState("Thanks for subscribing! We'll keep you posted on new releases.");
    }
    throw error;
  }

  await syncResendAudienceContact(email);

  const unsubUrl = `${env.siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  await sendEmail({
    to: email,
    subject: "Welcome to the KDILGAMES newsletter",
    html: `<p>Welcome to <strong>KDILGAMES</strong>!</p><p>You'll receive occasional updates about our games (including ByteRack Tycoon), creator drops, and devlogs.</p><p style="font-size:12px;color:#666;">Unsubscribe anytime: <a href="${escapeHtml(unsubUrl)}">${escapeHtml(unsubUrl)}</a></p>`,
    text: `Welcome to KDILGAMES!\n\nYou'll receive occasional updates on our games and marketplace releases.\n\nUnsubscribe anytime: ${unsubUrl}`,
  });

  return successState("Subscribed! Watch your inbox for game launches and dev updates.");
}
