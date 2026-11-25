import { randomBytes } from "node:crypto";
import { z } from "zod";

export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(160),
  source: z.string().trim().max(40).optional().default("homepage"),
  locale: z.enum(["en", "hr"]).optional().default("en"),
});

export function generateUnsubscribeToken(): string {
  return randomBytes(24).toString("hex");
}

export function normalizeNewsletterEmail(email: string): string {
  return email.trim().toLowerCase();
}
