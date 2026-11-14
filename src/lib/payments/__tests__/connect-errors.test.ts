import { describe, expect, it } from "vitest";

import {
  formatStripeConnectError,
  isCapabilitiesRetryError,
  isMissingStripeAccountError,
  MissingStripeAccountError,
} from "../connect-errors";

describe("Stripe Connect error helpers", () => {
  it("recognises missing Connect accounts from Stripe error codes or messages", () => {
    expect(isMissingStripeAccountError(new MissingStripeAccountError("missing"))).toBe(true);
    expect(
      isMissingStripeAccountError({
        code: "resource_missing",
        message: "No such account: 'acct_123'",
      }),
    ).toBe(true);
    expect(
      isMissingStripeAccountError({
        code: "account_invalid",
        message: "You do not have access to account acct_123",
      }),
    ).toBe(true);
    expect(
      isMissingStripeAccountError(new Error("You can only create new accounts if you've signed up for Connect.")),
    ).toBe(false);
  });

  it("identifies capability errors eligible for fallback retry without masking Connect onboarding errors", () => {
    expect(
      isCapabilitiesRetryError(
        new Error("Your platform cannot request the transfers capability without card_payments."),
      ),
    ).toBe(true);
    expect(
      isCapabilitiesRetryError(
        new Error("You can only create new accounts if you've signed up for Connect."),
      ),
    ).toBe(false);
    expect(
      isCapabilitiesRetryError(
        new Error("Please complete your platform profile before creating Express accounts."),
      ),
    ).toBe(false);
  });

  it("produces clear actionable guidance for common Stripe Connect setup failures", () => {
    expect(
      formatStripeConnectError(
        new Error("You can only create new accounts if you've signed up for Connect."),
      ),
    ).toContain("Stripe Connect is not enabled");

    expect(
      formatStripeConnectError(
        new Error("Please complete your platform profile before creating Express accounts."),
      ),
    ).toContain("Platform Profile");

    expect(
      formatStripeConnectError(
        new Error("Livemode requests must use HTTPS."),
      ),
    ).toContain("HTTPS");

    expect(
      formatStripeConnectError(
        new Error("Invalid country"),
        "XX",
      ),
    ).toContain('"XX"');
  });
});
