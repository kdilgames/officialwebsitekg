import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";

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
export class ConnectError extends Error {}

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
  return /^[A-Z]{2}$/.test(country.toUpperCase());
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

  const account = await stripe.accounts.create({
    type: "express",
    country: params.country.toUpperCase(),
    email: params.email,
    business_type: "individual",
    capabilities: { transfers: { requested: true } },
    business_profile: { name: params.storeName },
    metadata: { sellerId: params.sellerId },
  });

  return account.id;
}

/** Returns a single-use onboarding link that expires quickly. */
export async function createOnboardingLink(accountId: string): Promise<string> {
  const stripe = connectStripe();

  const link = await stripe.accountLinks.create({
    account: accountId,
    // Stripe requires both URLs; the dashboard page re-checks the account state
    // when the seller comes back, so neither URL is trusted for authorisation.
    refresh_url: `${env.siteUrl}/dashboard/settings?connect=refresh`,
    return_url: `${env.siteUrl}/dashboard/settings?connect=return`,
    type: "account_onboarding",
  });

  return link.url;
}

/** Reads the live account state directly from Stripe, never from the browser. */
export async function retrieveConnectStatus(accountId: string): Promise<ConnectAccountStatus> {
  const stripe = connectStripe();
  const account = await stripe.accounts.retrieve(accountId);

  return {
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
  };
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
}
