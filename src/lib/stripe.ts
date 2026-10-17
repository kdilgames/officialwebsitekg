import Stripe from "stripe";

import { env } from "@/lib/env";

let cached: Stripe | undefined;

/**
 * Returns the Stripe client, or null when no secret key has been provisioned.
 *
 * Nothing in the marketplace simulates a payment: when this returns null the
 * checkout endpoints respond with an explicit "payments are not configured"
 * error instead of pretending an order succeeded.
 */
export function getStripe(): Stripe | null {
  if (!env.stripe.secretKey) return null;
  cached ??= new Stripe(env.stripe.secretKey, {
    appInfo: { name: "KDILGAMES Marketplace", version: "1.0.0" },
  });
  return cached;
}

export function requireStripe(): Stripe {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY (test mode is fine) before accepting payments.",
    );
  }
  return stripe;
}

/** True when the key is a test-mode key, so orders can be flagged accordingly. */
export function isStripeTestMode(): boolean {
  const key = env.stripe.secretKey;
  if (!key) return false;
  return key.startsWith("sk_test_") || key.startsWith("rk_test_");
}
