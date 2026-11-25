import { z } from "zod";

const checkedBoolean = z.preprocess(
  (value) => value === true || value === "true" || value === "on" || value === "1",
  z.literal(true, { message: "This declaration is required." }),
);

export const dmcaNoticeSchema = z.object({
  claimantName: z.string().trim().min(2, "Full name is required.").max(120),
  claimantEmail: z.string().trim().email("A valid contact email is required.").max(160),
  claimantCompany: z.string().trim().max(140).optional().or(z.literal("")),
  productUrl: z
    .string()
    .trim()
    .url("Provide the full URL of the allegedly infringing listing.")
    .max(500),
  originalWorkUrl: z
    .string()
    .trim()
    .url("Provide a link to your original copyrighted work or repository.")
    .max(500),
  description: z
    .string()
    .trim()
    .min(30, "Describe the original work and the infringing material in at least 30 characters.")
    .max(4000),
  goodFaithStatement: checkedBoolean,
  accuracyStatement: checkedBoolean,
  signature: z.string().trim().min(2, "Electronic signature (your full legal name) is required.").max(120),
});

export type DmcaNoticeInput = z.infer<typeof dmcaNoticeSchema>;

export function generateDmcaNoticeNumber(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X");
  return `DMCA-${stamp}-${suffix}`;
}

/**
 * Extracts a marketplace product slug from a listing URL like
 * `https://kdilgames.com/product/my-plugin` -> `"my-plugin"`.
 */
export function extractProductSlugFromUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const match = parsed.pathname.match(/^\/product\/([a-z0-9-]+)(?:\/|$)/i);
    return match?.[1] ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}
