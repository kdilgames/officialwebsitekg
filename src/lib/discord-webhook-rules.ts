/**
 * Pure validation and payload builder for Discord product-release webhooks.
 *
 * Kept free of Next.js / Prisma imports so unit tests can import directly.
 */

export const ALLOWED_DISCORD_WEBHOOK_HOSTS = new Set([
  "discord.com",
  "discordapp.com",
  "ptb.discord.com",
  "canary.discord.com",
]);

const DISCORD_WEBHOOK_PATH_RE = /^\/api\/(?:v\d+\/)?webhooks\/[0-9]{15,25}\/[A-Za-z0-9_-]{20,}$/;

export function parseDiscordWebhookUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password || parsed.port) return null;
  if (!ALLOWED_DISCORD_WEBHOOK_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  if (!DISCORD_WEBHOOK_PATH_RE.test(parsed.pathname)) return null;

  parsed.hash = "";
  const threadId = parsed.searchParams.get("thread_id");
  parsed.search = "";
  if (threadId && /^[0-9]{15,25}$/.test(threadId)) {
    parsed.searchParams.set("thread_id", threadId);
  }

  return parsed.toString();
}

export function isValidDiscordWebhookUrl(raw: unknown): boolean {
  return parseDiscordWebhookUrl(raw) !== null;
}

export function maskDiscordWebhookUrl(raw: string): string {
  const parsed = parseDiscordWebhookUrl(raw);
  if (!parsed) return "";
  try {
    const url = new URL(parsed);
    const segments = url.pathname.split("/");
    const token = segments[segments.length - 1] ?? "";
    const maskedToken = token.length > 8 ? `${token.slice(0, 4)}…${token.slice(-4)}` : "••••";
    segments[segments.length - 1] = maskedToken;
    return `${url.origin}${segments.join("/")}${url.search}`;
  } catch {
    return "https://discord.com/api/webhooks/••••";
  }
}

export type DiscordReleaseProduct = {
  title: string;
  slug: string;
  shortDescription: string;
  priceLabel: string;
  categoryName: string;
  storeName: string;
  version: string;
  thumbnailUrl?: string | null;
};

export function buildProductReleaseDiscordPayload(input: {
  platformName: string;
  siteOrigin: string;
  product: DiscordReleaseProduct;
}) {
  const origin = input.siteOrigin.replace(/\/+$/, "");
  const productUrl = `${origin}/product/${input.product.slug}`;
  const thumb =
    input.product.thumbnailUrl && input.product.thumbnailUrl.startsWith("https://")
      ? input.product.thumbnailUrl
      : undefined;

  return {
    username: input.platformName,
    content: `New listing live on **${input.platformName}**`,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: input.product.title.slice(0, 256),
        url: productUrl,
        description: input.product.shortDescription.slice(0, 400),
        color: 0x2f6fed,
        fields: [
          { name: "Price", value: input.product.priceLabel, inline: true },
          { name: "Category", value: input.product.categoryName, inline: true },
          { name: "Creator", value: input.product.storeName, inline: true },
          { name: "Version", value: `v${input.product.version}`, inline: true },
        ],
        ...(thumb ? { thumbnail: { url: thumb } } : {}),
        footer: { text: `${input.platformName} Marketplace` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
