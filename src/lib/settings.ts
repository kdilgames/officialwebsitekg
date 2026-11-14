import { prisma } from "@/lib/db";

export const SITE_ANNOUNCEMENT_KEY = "site_announcement";

export type AnnouncementTone = "info" | "accent" | "positive";

export type SiteAnnouncement = {
  enabled: boolean;
  text: string;
  href?: string;
  linkLabel?: string;
  tone: AnnouncementTone;
};

export function safeAnnouncementHref(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function parseSiteAnnouncement(value: unknown): SiteAnnouncement | null {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    return { enabled: true, text, tone: "info" };
  }

  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text.trim() : "";
  if (!text) return null;

  const enabled = record.enabled !== false;
  const toneRaw = record.tone;
  const tone: AnnouncementTone =
    toneRaw === "accent" || toneRaw === "positive" || toneRaw === "info" ? toneRaw : "info";
  const href = safeAnnouncementHref(record.href);
  const linkLabel =
    typeof record.linkLabel === "string" && record.linkLabel.trim().length > 0
      ? record.linkLabel.trim().slice(0, 40)
      : undefined;

  return { enabled, text, href, linkLabel, tone };
}

export async function getSiteAnnouncement(): Promise<SiteAnnouncement | null> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SITE_ANNOUNCEMENT_KEY },
      select: { value: true },
    });
    const parsed = parseSiteAnnouncement(setting?.value);
    return parsed && parsed.enabled ? parsed : null;
  } catch {
    return null;
  }
}

export async function getSiteAnnouncementRaw(): Promise<SiteAnnouncement | null> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SITE_ANNOUNCEMENT_KEY },
      select: { value: true },
    });
    return parseSiteAnnouncement(setting?.value);
  } catch {
    return null;
  }
}
