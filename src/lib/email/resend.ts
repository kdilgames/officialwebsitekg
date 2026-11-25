const RESEND_API_URL = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendEmailResult = {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
};

/**
 * Sends a transactional email through the Resend HTTP API.
 *
 * Graceful fallback: when `RESEND_API_KEY` is unset, logs a concise notice and
 * returns `{ ok: true, skipped: true }` without throwing. Network or provider
 * errors are logged and returned as `{ ok: false, error }` so email failures
 * never interrupt payment webhooks, ticket replies, or release publishing.
 */
export async function sendEmail(
  input: SendEmailInput,
  options?: {
    apiKey?: string | null;
    from?: string | null;
    fetchImpl?: typeof fetch;
  },
): Promise<SendEmailResult> {
  const apiKey = (options?.apiKey ?? process.env.RESEND_API_KEY ?? "").trim();
  const from = (
    options?.from ??
    process.env.EMAIL_FROM ??
    "KDILGAMES <noreply@kdilgames.com>"
  ).trim();

  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((entry) => entry.trim())
    .filter((entry) => entry.includes("@") && !entry.endsWith("@deleted.invalid"));

  if (recipients.length === 0) {
    return { ok: true, skipped: true };
  }

  if (!apiKey) {
    console.info(`[email:skipped] Resend not configured — "${input.subject}" -> ${recipients.join(", ")}`);
    return { ok: true, skipped: true };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      console.warn(`[email:resend] HTTP ${response.status} for "${input.subject}": ${bodyText.slice(0, 200)}`);
      return { ok: false, error: `Resend HTTP ${response.status}` };
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[email:resend] request failed for "${input.subject}":`, message);
    return { ok: false, error: message };
  }
}
