const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const TURNSTILE_FIELD_NAME = "cf-turnstile-response";

export type TurnstileVerifyResult = {
  ok: boolean;
  skipped?: boolean;
  errorCodes?: string[];
  message?: string;
};

/**
 * Verifies a Cloudflare Turnstile response token on the server.
 *
 * Graceful fallback: when `TURNSTILE_SECRET_KEY` is not set, verification
 * succeeds with `skipped: true` so local development and deployments without
 * Turnstile keys keep working without friction.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
  options?: {
    secretKey?: string | null;
    fetchImpl?: typeof fetch;
  },
): Promise<TurnstileVerifyResult> {
  const secret = (options?.secretKey ?? process.env.TURNSTILE_SECRET_KEY ?? "").trim();
  if (!secret) {
    return { ok: true, skipped: true };
  }

  const trimmedToken = typeof token === "string" ? token.trim() : "";
  if (!trimmedToken) {
    return {
      ok: false,
      errorCodes: ["missing-input-response"],
      message: "Please complete the human verification challenge and try again.",
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const body = new URLSearchParams({
      secret,
      response: trimmedToken,
    });
    if (remoteIp) {
      body.set("remoteip", remoteIp);
    }

    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.warn(`[turnstile] siteverify returned HTTP ${response.status}; failing open.`);
      return { ok: true, skipped: true };
    }

    const payload = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (payload.success) {
      return { ok: true };
    }

    return {
      ok: false,
      errorCodes: payload["error-codes"] ?? ["verification-failed"],
      message: "Human verification failed. Please reload the check and try again.",
    };
  } catch (error) {
    console.warn("[turnstile] siteverify request failed; failing open:", error);
    return { ok: true, skipped: true };
  }
}

/** Convenience helper for FormData-based Server Actions. */
export async function verifyTurnstileFromFormData(
  formData: FormData,
  remoteIp?: string | null,
): Promise<TurnstileVerifyResult> {
  const raw = formData.get(TURNSTILE_FIELD_NAME);
  return verifyTurnstileToken(typeof raw === "string" ? raw : null, remoteIp);
}
