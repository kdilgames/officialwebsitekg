/**
 * Media & external link validation helpers.
 *
 * All URLs persisted on product listings or site settings are strictly parsed
 * and restricted to HTTP(S) origins to prevent `javascript:` or `data:` payloads.
 */

export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export type VideoEmbed = {
  provider: "youtube" | "vimeo";
  embedUrl: string;
};

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const VIMEO_ID_RE = /^\d{6,12}$/;

/**
 * Extracts a safe, privacy-enhanced iframe embed URL from standard YouTube or Vimeo links.
 */
export function parseVideoEmbedUrl(raw: string | null | undefined): VideoEmbed | null {
  const safe = safeHttpUrl(raw);
  if (!safe) return null;

  let url: URL;
  try {
    url = new URL(safe);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtu.be") {
    const segment = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (YOUTUBE_ID_RE.test(segment)) {
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${segment}?rel=0`,
      };
    }
    return null;
  }

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    let candidate = url.searchParams.get("v") ?? "";
    if (!candidate) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") {
        candidate = parts[1] ?? "";
      }
    }
    if (YOUTUBE_ID_RE.test(candidate)) {
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${candidate}?rel=0`,
      };
    }
    return null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const candidate =
      host === "player.vimeo.com" && parts[0] === "video"
        ? (parts[1] ?? "")
        : (parts[0] ?? "");
    if (VIMEO_ID_RE.test(candidate)) {
      return {
        provider: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${candidate}`,
      };
    }
    return null;
  }

  return null;
}
