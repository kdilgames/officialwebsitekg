import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import {
  ConnectError,
  MissingStripeAccountError,
  formatStripeConnectError,
  isCapabilitiesRetryError,
  isMissingStripeAccountError,
} from "@/lib/payments/connect-errors";

export { ConnectError, MissingStripeAccountError };

/**
 * Stripe Connect helpers.
 *
 * Sellers are onboarded as Stripe Express accounts owned by the platform. The
 * buyer is charged once on the platform account ("separate charges and
 * transfers") and each seller is paid with a Stripe Transfer once their
 * earnings clear the hold period. The marketplace therefore never holds a
 * customer-funded balance of its own — the ledger below only mirrors what
 * Stripe will move.
 *
 * Nothing in this file fabricates a result: every value comes from Stripe, and
 * when no secret key is provisioned the caller receives an explicit error.
 */

function connectStripe() {
  const stripe = getStripe();
  if (!stripe) {
    throw new ConnectError(
      "Payments are not configured on this deployment. An administrator must provide Stripe Connect credentials before sellers can be onboarded.",
    );
  }
  return stripe;
}

/** Stripe requires a supported two-letter country for a connected account. */
export function isSupportedConnectCountry(country: string | null | undefined): boolean {
  if (!country) return false;
  return /^[A-Z]{2}$/.test(country.trim().toUpperCase());
}

export type ConnectAccountStatus = {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[];
};

/** Creates an Express account for a seller and returns its id. */
export async function createConnectAccount(params: {
  sellerId: string;
  email: string;
  country: string;
  storeName: string;
}): Promise<string> {
  const stripe = connectStripe();
  const country = params.country.trim().toUpperCase();
  const businessName = params.storeName.trim() || "KDILGAMES Seller";

  const basePayload = {
    type: "express" as const,
    country,
    email: params.email,
    business_type: "individual" as const,
    business_profile: { name: businessName },
    metadata: { sellerId: params.sellerId },
  };

  try {
    const account = await stripe.accounts.create({
      ...basePayload,
      capabilities: { transfers: { requested: true } },
    });
    return account.id;
  } catch (error) {
    if (isCapabilitiesRetryError(error)) {
      try {
        const account = await stripe.accounts.create({
          ...basePayload,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });
        return account.id;
      } catch (retryError) {
        console.error("[stripe-connect] createConnectAccount retry failed:", retryError);
        throw new ConnectError(formatStripeConnectError(retryError, country));
      }
    }

    console.error("[stripe-connect] createConnectAccount failed:", error);
    throw new ConnectError(formatStripeConnectError(error, country));
  }
}

/** Returns a single-use onboarding link that expires quickly. */
export async function createOnboardingLink(
  accountId: string,
  origin?: string,
): Promise<string> {
  const stripe = connectStripe();
  const baseUrl = origin ?? env.siteUrl;

  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      // Stripe requires both URLs; the dashboard page re-checks the account state
      // when the seller comes back, so neither URL is trusted for authorisation.
      refresh_url: `${baseUrl}/dashboard/settings?connect=refresh`,
      return_url: `${baseUrl}/dashboard/settings?connect=return`,
      type: "account_onboarding",
    });

    return link.url;
  } catch (error) {
    console.error("[stripe-connect] createOnboardingLink failed:", error);
    if (isMissingStripeAccountError(error)) {
      throw new MissingStripeAccountError(
        "The previously saved Stripe account ID no longer exists in the active Stripe mode.",
      );
    }
    throw new ConnectError(formatStripeConnectError(error));
  }
}

/** Reads the live account state directly from Stripe, never from the browser. */
export async function retrieveConnectStatus(accountId: string): Promise<ConnectAccountStatus> {
  const stripe = connectStripe();

  try {
    const account = await stripe.accounts.retrieve(accountId);

    return {
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
      requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
    };
  } catch (error) {
    console.error("[stripe-connect] retrieveConnectStatus failed:", error);
    if (isMissingStripeAccountError(error)) {
      throw new MissingStripeAccountError(
        "This Stripe connected account could not be found in the active Stripe mode.",
      );
    }
    throw new ConnectError(formatStripeConnectError(error));
  }
}

/**
 * Moves a seller's payable balance to their connected account.
 *
 * `idempotencyKey` is derived from the payout row id, so a retried request can
 * never move the same money twice.
 */
export async function createSellerTransfer(params: {
  accountId: string;
  amountMinor: number;
  currency: string;
  payoutId: string;
  transferGroup: string;
}): Promise<{ transferId: string }> {
  const stripe = connectStripe();

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: params.amountMinor,
        currency: params.currency.toLowerCase(),
        destination: params.accountId,
        transfer_group: params.transferGroup,
        metadata: { payoutId: params.payoutId },
      },
      { idempotencyKey: `payout:${params.payoutId}` },
    );

    return { transferId: transfer.id };
  } catch (error) {
    console.error("[stripe-connect] createSellerTransfer failed:", error);
    throw new ConnectError(formatStripeConnectError(error));
  }
}
