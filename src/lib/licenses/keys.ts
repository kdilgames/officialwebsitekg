import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excludes 0, O, 1, I to avoid transcription mistakes.

/**
 * Generates a cryptographically random, human-readable software license key
 * in the form `KDIL-XXXX-XXXX-XXXX-XXXX` (80 bits of entropy).
 */
export function generateLicenseKey(): string {
  const bytes = randomBytes(16);
  const chars: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    chars.push(ALPHABET[bytes[i]! % ALPHABET.length]!);
  }
  return `KDIL-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}`;
}

export function normalizeLicenseKey(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidLicenseKeyFormat(raw: string): boolean {
  return /^KDIL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizeLicenseKey(raw));
}
