import { z } from "zod";

export const STUDIO_FACILITY_NAMES = [
  "Small Bedroom",
  "Home Garage",
  "Brick Workshop",
  "Metro Server Hall",
  "Nordic Hydro Plant",
  "Alpine Summit Vault",
  "Offshore Sea Rig",
  "Geothermal Island Plant",
  "Arctic Deep Vault",
] as const;

export const leaderboardSubmissionSchema = z.object({
  playerKey: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{12,64}$/, "Invalid player identifier."),
  companyName: z.string().trim().min(1).max(40),
  lifetimeEarnings: z.number().finite().min(0).max(1e120),
  techTokens: z.number().finite().min(0).max(9_000_000_000_000),
  facilityLevel: z.number().int().min(0).max(STUDIO_FACILITY_NAMES.length - 1),
  activeServers: z.number().int().min(0).max(200_000),
  contractsDone: z.number().int().min(0).max(100_000),
  appVersion: z.string().trim().max(16).optional(),
});

export type LeaderboardSubmission = z.infer<typeof leaderboardSubmissionSchema>;

export type PublicLeaderboardEntry = {
  rank: number;
  companyName: string;
  lifetimeEarnings: number;
  techTokens: number;
  facilityLevel: number;
  facilityName: string;
  league: string;
  activeServers: number;
  contractsDone: number;
  isMe: boolean;
  updatedAt: string;
};

export type StudioLeaderboardSnapshot = {
  appSlug: string;
  totalPlayers: number;
  entries: PublicLeaderboardEntry[];
  me: PublicLeaderboardEntry | null;
};

export function sanitizeStudioName(raw: string): string {
  const cleaned = raw
    .replace(/[<>&"'`\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
  return cleaned.length > 0 ? cleaned : "ByteRack Studio";
}

export function isValidPlayerKey(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && /^[a-zA-Z0-9_-]{12,64}$/.test(raw);
}

export function getFacilityDisplayName(level: number): string {
  const clamped = Math.max(0, Math.min(STUDIO_FACILITY_NAMES.length - 1, level));
  return STUDIO_FACILITY_NAMES[clamped] ?? "Small Bedroom";
}

export function getStudioLeague(facilityLevel: number, lifetimeEarnings: number): string {
  if (facilityLevel >= 8 || lifetimeEarnings >= 1e18) return "Arctic Sovereign";
  if (facilityLevel >= 6 || lifetimeEarnings >= 1e12) return "Oceanic Titan";
  if (facilityLevel >= 4 || lifetimeEarnings >= 1e8) return "Cloud Architect";
  if (facilityLevel >= 2 || lifetimeEarnings >= 250_000) return "Metro Operator";
  return "Garage Founder";
}

const COMPACT_SUFFIXES = [
  "",
  "K",
  "M",
  "B",
  "T",
  "Qa",
  "Qi",
  "Sx",
  "Sp",
  "Oc",
  "No",
  "Dc",
];

function formatCompactMagnitude(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  if (amount < 1000) return `${Math.floor(amount)}`;
  const group = Math.max(0, Math.floor(Math.log10(amount) / 3));
  if (group >= COMPACT_SUFFIXES.length) {
    const exp = Math.floor(Math.log10(amount));
    const mantissa = amount / Math.pow(10, exp);
    return `${mantissa.toFixed(2)}e${exp}`;
  }
  const scaled = amount / Math.pow(1000, group);
  const suffix = COMPACT_SUFFIXES[group] ?? "";
  const formatted = scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2);
  return `${formatted}${suffix}`;
}

export function formatCompactUsd(amount: number): string {
  return `$${formatCompactMagnitude(amount)}`;
}

export function formatCompactCount(amount: number): string {
  return formatCompactMagnitude(amount);
}
