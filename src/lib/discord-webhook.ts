import { getRequestOrigin } from "@/lib/utils/origin";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { getDiscordReleaseWebhookUrl } from "@/lib/settings";
import {
  buildProductReleaseDiscordPayload,
  parseDiscordWebhookUrl,
  type DiscordReleaseProduct,
} from "@/lib/discord-webhook-rules";

export type DiscordWebhookResult = { ok: true } | { ok: false; error: string };

export async function postDiscordWebhookPayload(
  webhookUrl: string,
  payload: unknown,
): Promise<DiscordWebhookResult> {
  const safeUrl = parseDiscordWebhookUrl(webhookUrl);
  if (!safeUrl) {
    return { ok: false, error: "Invalid Discord webhook URL." };
  }

  try {
    const response = await fetch(safeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Discord returned HTTP ${response.status}. Check that the webhook still exists.`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not reach Discord.",
    };
  }
}

export async function sendDiscordTestWebhook(
  webhookUrl: string,
  siteOrigin?: string,
): Promise<DiscordWebhookResult> {
  const origin = (siteOrigin ?? (await getRequestOrigin())).replace(/\/+$/, "");
  return postDiscordWebhookPayload(webhookUrl, {
    username: env.marketplace.platformName,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `${env.marketplace.platformName} webhook connected`,
        url: origin,
        description:
          "New products approved in Administration will automatically post an announcement card in this channel.",
        color: 0x16a34a,
        footer: { text: `${env.marketplace.platformName} Administration` },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

export async function notifyDiscordApprovedProduct(input: {
  slug: string;
  title: string;
  shortDescription: string;
  priceMinor: number;
  salePriceMinor: number | null;
  currency: string;
  version: string;
  thumbnailUrl: string | null;
  categoryName: string;
  storeName: string;
}): Promise<void> {
  try {
    const webhookUrl = await getDiscordReleaseWebhookUrl();
    if (!webhookUrl) return;

    const unitMinor = input.salePriceMinor ?? input.priceMinor;
    const priceLabel = unitMinor === 0 ? "Free" : formatMoney(unitMinor, input.currency);
    const origin = await getRequestOrigin();

    const product: DiscordReleaseProduct = {
      title: input.title,
      slug: input.slug,
      shortDescription: input.shortDescription,
      priceLabel,
      categoryName: input.categoryName,
      storeName: input.storeName,
      version: input.version,
      thumbnailUrl: input.thumbnailUrl,
    };

    const payload = buildProductReleaseDiscordPayload({
      platformName: env.marketplace.platformName,
      siteOrigin: origin,
      product,
    });

    const result = await postDiscordWebhookPayload(webhookUrl, payload);
    if (!result.ok) {
      console.warn("Discord release webhook notification failed:", result.error);
    }
  } catch (error) {
    console.warn("Discord release webhook error:", error);
  }
}
