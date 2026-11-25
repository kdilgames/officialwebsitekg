/**
 * Pure Stripe Connect error classification & messaging helpers.
 * No Stripe SDK or Next.js runtime imports so Vitest can test directly.
 */

export class ConnectError extends Error {}

export class MissingStripeAccountError extends ConnectError {}

type ErrorShape = {
  code?: unknown;
  type?: unknown;
  statusCode?: unknown;
  message?: unknown;
};

function asShape(error: unknown): ErrorShape {
  return error && typeof error === "object" ? (error as ErrorShape) : {};
}

export function isMissingStripeAccountError(error: unknown): boolean {
  if (error instanceof MissingStripeAccountError) return true;
  const shape = asShape(error);
  const code = typeof shape.code === "string" ? shape.code : "";
  const message =
    error instanceof Error
      ? error.message
      : typeof shape.message === "string"
        ? shape.message
        : "";

  if (code === "resource_missing" || code === "account_invalid") {
    return /account/i.test(message) || code === "account_invalid";
  }

  return /no such account|does not have access to account|account .* does not exist/i.test(
    message,
  );
}

export function isCapabilitiesRetryError(error: unknown): boolean {
  const shape = asShape(error);
  const message =
    error instanceof Error
      ? error.message
      : typeof shape.message === "string"
        ? shape.message
        : "";

  if (!message) return false;
  if (/signed up for connect|platform profile|responsibilities/i.test(message)) {
    return false;
  }

  return /card_payments|transfers capability|capabilities|service_agreement/i.test(message);
}

export function formatStripeConnectError(error: unknown, country?: string): string {
  const shape = asShape(error);
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof shape.message === "string"
        ? shape.message
        : "";
  const type = typeof shape.type === "string" ? shape.type : "";

  if (/signed up for connect|connect is not enabled|enable connect/i.test(rawMessage)) {
    return "Stripe Connect is not enabled on this Stripe account yet. In your Stripe Dashboard, open Connect → Get started to activate Express accounts, then try again.";
  }

  if (/platform profile|responsibilities|loss liability|managing losses/i.test(rawMessage)) {
    return "Your Stripe Connect Platform Profile is incomplete. Finish the Connect Platform Profile questionnaire in your Stripe Dashboard, then try again.";
  }

  if (/livemode requests must use https|not a valid url|invalid url/i.test(rawMessage)) {
    return "Stripe requires a valid HTTPS return URL in live mode. Access the marketplace over HTTPS or configure NEXT_PUBLIC_SITE_URL.";
  }

  if (
    type === "StripeAuthenticationError" ||
    /invalid api key|api key expired|no api key provided/i.test(rawMessage)
  ) {
    return "The configured STRIPE_SECRET_KEY was rejected by Stripe. Check your Stripe keys in deployment environment variables.";
  }

  if (/invalid country|country .* not supported|cannot create .* accounts in/i.test(rawMessage)) {
    return country
      ? `Country code "${country}" is not supported by Stripe Connect Express accounts.`
      : "That country code is not supported by Stripe Connect Express accounts.";
  }

  if (rawMessage) {
    return `Stripe could not connect the payout account: ${rawMessage}`;
  }

  return "Could not connect to Stripe right now. Try again in a moment.";
}
