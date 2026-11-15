import { stripBbcode } from "./bbcode";

const UPDATE_TITLE_RE = /^\[update-title\]([^\r\n]*?)\[\/update-title\](?:\r?\n)*([\s\S]*)$/;

/**
 * Encodes an optional single-line update title and rich BBCode body into
 * `ProductVersion.changelog` without requiring a schema migration.
 */
export function encodeUpdateChangelog(
  title: string | null | undefined,
  body: string,
): string {
  const cleanTitle = (title ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\[\/?update-title\]/gi, "")
    .trim()
    .slice(0, 140);
  const cleanBody = body.trim();

  if (!cleanTitle) return cleanBody;
  return cleanBody
    ? `[update-title]${cleanTitle}[/update-title]\n\n${cleanBody}`
    : `[update-title]${cleanTitle}[/update-title]`;
}

/**
 * Extracts `{ title, body }` from a stored `ProductVersion.changelog`.
 * Legacy plain-text or untitled BBCode changelogs return `title: null`.
 */
export function parseUpdateChangelog(raw: string | null | undefined): {
  title: string | null;
  body: string;
} {
  if (!raw) return { title: null, body: "" };
  const trimmed = raw.trim();
  const match = UPDATE_TITLE_RE.exec(trimmed);
  if (!match) {
    return { title: null, body: trimmed };
  }
  const title = match[1]?.trim() || null;
  const body = match[2]?.trim() ?? "";
  return { title, body };
}

/**
 * Formats a concise plain-text notification message for buyer notifications.
 */
export function formatVersionNotificationBody(
  rawChangelog: string | null | undefined,
  version: string,
): string {
  const parsed = parseUpdateChangelog(rawChangelog);
  const plainBody = stripBbcode(parsed.body);

  if (parsed.title && plainBody) {
    return `${parsed.title} — ${plainBody}`.slice(0, 140);
  }
  if (parsed.title) return parsed.title.slice(0, 140);
  if (plainBody) return plainBody.slice(0, 140);
  return `Version ${version} released.`;
}
