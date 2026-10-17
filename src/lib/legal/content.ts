import { env } from "@/lib/env";

/**
 * Default marketplace policies.
 *
 * These documents describe what the software actually does (how orders are
 * priced, when money moves, what data is stored) and double as the seed content
 * for the `LegalPage` table. An administrator can override any of them from the
 * database without a deployment; this module is the fallback that keeps every
 * footer link resolving on a fresh installation.
 *
 * IMPORTANT: this text is a starting point written by engineers, not lawyers.
 * The operator remains responsible for having these policies — and the tax,
 * consumer-protection and record-keeping obligations that sit behind them —
 * reviewed by a qualified professional before relying on them.
 */

export type LegalDocument = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  version: string;
};

const PLATFORM = env.marketplace.platformName;
const DEFAULT_COMMISSION_PERCENT = (env.marketplace.defaultCommissionBps / 100).toFixed(0);

export const LEGAL_PAGES: LegalDocument[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    summary: `The rules for buying and selling digital products on ${PLATFORM}.`,
    version: "1.0",
    body: `This document is a template and requires review by a qualified professional before it is relied upon.

## 1. Who we are

${PLATFORM} operates a marketplace on which independent sellers offer digital products — game assets, plugins, bots, templates and developer tooling. ${PLATFORM} is not the author of the products listed by sellers; it provides the storefront, the payment handling and the delivery of the files.

## 2. Your account

- You must provide accurate registration details and keep your password confidential.
- You are responsible for activity performed through your account.
- One person or organisation should not maintain accounts created to evade a suspension.
- We may suspend or close an account that breaches these terms, that is used for fraud, or that is required to be closed by law.

## 3. Buying

- A contract of sale for a product is formed between you and the seller of that product, not with ${PLATFORM}.
- Prices, currencies and any discounts are shown on the product page before you pay. The amount charged is the amount shown at checkout, in integer minor units of the displayed currency.
- Payment is processed by our payment provider. ${PLATFORM} does not store your full card details.
- A purchase grants the licence described on the product page. It does not transfer ownership of the product itself.

## 4. Selling

- Selling requires an approved seller account and an identity verification performed by our payment provider.
- Sellers are responsible for the products they list, for their legality, and for honouring the licence they grant.
- Sellers must not list products they do not have the right to distribute.
- A commission is deducted from each sale; the applicable rate is shown in the seller dashboard and is recorded on every order.

## 5. Prohibited content

Products and content that are unlawful, infringing, malicious, deceptive, or that contain credential-stealing code, malware or deliberately obfuscated payloads are prohibited. Reports about such listings are reviewed by platform staff.

## 6. Availability and changes

${PLATFORM} may change, suspend or discontinue any part of the marketplace. Material changes to these terms are published as a new version of this document, and the version in force is displayed on this page.

## 7. Liability

To the extent permitted by applicable law, ${PLATFORM}'s liability is limited to the amount of the commission it received on the transaction giving rise to the claim. Nothing in these terms limits rights that consumers have under mandatory law.

## 8. Governing law

The platform is operated from Croatia (EU). The governing law, the competent courts and the applicable consumer-protection rules must be confirmed with a qualified professional for your situation.

## 9. Contact

Questions about these terms can be raised through the support centre.`,
  },

  {
    slug: "privacy",
    title: "Privacy Policy",
    summary: "What personal data the marketplace stores, why, and how to exercise your rights.",
    version: "1.0",
    body: `This document is a template and requires review by a qualified professional before it is relied upon.

## What we store

- **Account data:** username, display name, email address, a hashed password, optional country and optional marketing preference. Passwords are hashed by our authentication provider; the plain text is never stored.
- **Purchase data:** orders, the products in them, the amount paid, the currency, the payment provider's references, and the receipt link.
- **Seller data:** store name, description, support details and the identifiers issued by our payment provider during onboarding. We do not ask sellers for identity documents or bank details — the payment provider collects those directly.
- **Operational data:** audit entries for administrative and financial actions, support tickets, reports and download records.

## Why we store it

To operate your account, to process and deliver purchases, to calculate commissions and payouts, to prevent and investigate fraud and abuse, and to meet legal and accounting obligations.

## Payments

Card data never reaches ${PLATFORM}. Payments and payouts are handled by our payment provider, which acts under its own privacy notice. We store only the references needed to reconcile a payment.

## Cookies

Session cookies are required to keep you signed in. See the Cookie Policy for details.

## Retention

Financial records are retained for as long as accounting and tax rules require. Support tickets and reports are retained while an investigation may still be needed. Account data is deleted or anonymised on request, except where a legal obligation requires retention.

## Your rights

Subject to applicable law you may request access, correction, deletion, restriction, portability, or object to processing, and you may withdraw consent for optional processing such as marketing. Requests can be raised through the support centre.

## Sharing

Personal data is shared with the payment provider, with infrastructure providers that host the application and the files, and with authorities where legally required. Sellers receive the information needed to fulfil a sale, but not your payment details.

## Security

Access to buyer and seller data is enforced on the server. Digital files are stored privately and delivered through signed links that expire.`,
  },

  {
    slug: "refunds",
    title: "Refund Policy",
    summary: "When a refund can be requested on a digital purchase, and how the process works.",
    version: "1.0",
    body: `This document is a template and requires review by a qualified professional before it is relied upon.

## How a refund works on this marketplace

1. You request a refund from the order in your account and explain the reason.
2. Platform staff review the request together with the order, the seller and any conversation on record.
3. If the request is approved, staff send the refund to our payment provider.
4. The refund is complete only when the payment provider confirms it. A refund that has been approved but not yet confirmed is shown as such — the marketplace never reports a refund as paid before the provider confirms it.

## Digital products

Digital products are delivered immediately and cannot be returned. A refund is therefore considered on the merits of the request rather than as an automatic right of withdrawal, while keeping any mandatory consumer rights that apply in your country.

## Grounds that are normally accepted

- The files were never delivered, or cannot be accessed, and the seller did not resolve it.
- The product does not work as described, and the seller did not resolve it.
- The listing was materially misleading.
- The product infringes someone else's rights, or contains malicious code.
- A duplicate charge or a payment error occurred.

## Grounds that are normally declined

- A change of mind after downloading and using the product.
- A request that conflicts with the licence you agreed to when buying (for example a request to use an asset in a way the licence forbids).
- A complaint that the seller already resolved by delivering a working update or a replacement.

## Timing

Request a refund as soon as the problem appears. Requests made long after the purchase, or after the product has been substantially used, may be declined.

## Effect on the seller

A completed refund reverses the corresponding seller earning. If the amount has already been paid out, it is recovered from the seller's later earnings.

## Chargebacks

If a card issuer reverses a payment, the platform is charged a dispute fee by the payment provider. Filing a chargeback instead of contacting support first may result in the account being suspended while the dispute is investigated.`,
  },

  {
    slug: "cookies",
    title: "Cookie Policy",
    summary: "The cookies the marketplace sets and what they are used for.",
    version: "1.0",
    body: `This document is a template and requires review by a qualified professional before it is relied upon.

## Strictly necessary cookies

- **Session cookies** keep you signed in after you log in. They are issued by our authentication provider and are required for the marketplace to work. Removing them signs you out.
- **CSRF/state cookies** protect forms and the sign-in and payment redirect flows from cross-site request forgery.

## Functional storage

- Your cart is stored against your account on the server, not in a tracking cookie.
- Preference values written by the interface (for example an open disclosure panel) are not shared with third parties.

## What we do not use

At the time of writing the marketplace sets no advertising cookies and no third-party analytics or tracking pixels. If that changes, this page will be updated and consent will be requested where the law requires it.

## Payment provider

When you are redirected to the payment provider to complete a purchase, that provider may set its own cookies on its own domain to process the payment and to detect fraud. Those cookies are governed by the provider's own policy.

## Managing cookies

You can block or delete cookies in your browser settings. Blocking strictly necessary cookies prevents sign-in and checkout from working.`,
  },

  {
    slug: "seller-agreement",
    title: "Seller Agreement",
    summary: "The terms a seller accepts when an application is approved.",
    version: "1.0",
    body: `This document is a template and requires review by a qualified professional before it is relied upon.

## 1. Approval

A seller account must be applied for and approved by platform staff. Approval is not permanent: a seller account can be suspended if these terms are breached. A seller never approves its own application or its own products.

## 2. What you are responsible for

- The products you upload, their quality and their legality.
- The licence you grant to buyers, and describing it accurately on the listing.
- Responding to buyer questions and support requests relating to your products.
- Keeping the files current, and delivering updates to previous buyers when you publish a new version.

## 3. Commission

A commission is deducted from each sale before your earnings are credited. The rate that applies to a sale is the rate resolved from the platform's commission rules at the moment the order is priced, and it is recorded on the order itself. A seller cannot change the applicable commission, and cannot change the balance of any earning.

The default platform commission is ${DEFAULT_COMMISSION_PERCENT}%, and it may be overridden per category, per seller or per product.

## 4. Payouts

- Payouts are processed to the account you onboarded with our payment provider.
- Earnings are held for a period after a sale (currently ${env.marketplace.earningsHoldDays} days) so that refunds and disputes can be settled against them.
- Refunded or disputed sales reverse the corresponding earning; if the money was already paid out, it is recovered from future earnings.
- Payout requests are reviewed and released by platform staff. Requesting a payout does not move money by itself, and the marketplace never reports a payout as sent before the payment provider confirms the transfer.

## 5. Prohibited products

No malware, credential stealers, deliberately obfuscated payloads, key generators, licence-circumvention tools, or content that infringes another party's rights. No listings that misrepresent what the buyer receives.

## 6. Data

You receive the information needed to fulfil an order. You must not use buyer data for anything else, and you must not contact buyers for unrelated marketing.

## 7. Reviews

Reviews come only from buyers with a paid order. You may reply to a review once, publicly, but you may not remove it, offer consideration for a review, or publish reviews yourself.

## 8. Termination

You can stop selling at any time. Platform staff can suspend or close a seller account for a breach of these terms, for a legal requirement, or to protect buyers. Earnings legitimately owed for completed sales remain owed, subject to refunds and disputes.`,
  },

  {
    slug: "fees",
    title: "Fees & Commissions",
    summary: "How the platform's commission is calculated, recorded and paid out.",
    version: "1.0",
    body: `This document is a template and requires review by a qualified professional before it is relied upon.

## One fee, deducted per sale

The only platform fee is the marketplace commission. It is deducted from the value of each sale; buyers pay the listed price and nothing else.

## How the rate is resolved

The commission rate is resolved for every order line in the following order of precedence:

1. A rule for the specific product.
2. A rule for the seller.
3. A rule for the product's category.
4. A rule for the platform as a whole.

The default platform commission is ${DEFAULT_COMMISSION_PERCENT}%. Administrators can create or disable rules for any of the scopes above; every rate is stored in basis points (1500 basis points = 15%) so that no rounding error can enter the calculation.

## How the money is split

- Every amount is stored as an integer number of minor units (cents) of a single currency, never as a floating-point number.
- The platform fee is rounded to the nearest minor unit, and the seller receives the exact remainder, so the two always add up to the amount paid.
- The split is stored on the order at the moment of payment and is never recomputed from a request sent by a browser.

Example: a €100.00 sale at a 15% commission is €15.00 of platform commission, with €85.00 credited to the seller.

## Payouts

Seller earnings become available after the hold period (currently ${env.marketplace.earningsHoldDays} days) that allows refunds and disputes to settle. Payouts are transferred to the seller's account at the payment provider and are only marked as sent once the provider confirms the transfer.

## Refunds

A refund reverses the corresponding earning, including the platform's own fee on the refunded amount. Where the earning was already paid out, the reversal is recovered from the seller's later earnings.

## Taxes

Buyers and sellers are responsible for their own tax obligations, including the reporting of income. Sellers are responsible for accounting for VAT or sales tax where their own registration requires it. This summary is not tax advice; obtain professional advice for your situation.`,
  },

  {
    slug: "copyright",
    title: "Copyright Complaints",
    summary: "How to report content that infringes intellectual property rights.",
    version: "1.0",
    body: `This document is a template and requires review by a qualified professional before it is relied upon.

## Reporting infringement

If you believe a listing on ${PLATFORM} infringes your rights, send a written notice through the support centre and mark it as a copyright complaint. A notice that can be acted on should contain:

- Identification of the work or material you claim has been infringed.
- The exact product URL or, where relevant, the seller page concerned.
- Your name, contact email and a statement that you have a good-faith belief that the use is not authorised by the rights holder, its agent or the law.
- A statement that the information in the notice is accurate, and that you are the rights holder or authorised to act on the rights holder's behalf.
- Your physical or electronic signature.

## What happens next

1. The listing is reviewed by platform staff, and the seller may be asked to respond.
2. While a complaint is investigated, the listing can be removed from the marketplace.
3. If the complaint is upheld, the content stays removed and the seller may be suspended.

## Counter-notice

A seller who believes a removal was mistaken may respond through the support centre with the reasons, and staff will review both positions before deciding.

## Repeat infringers

Sellers who repeatedly upload infringing content are suspended and their catalogue is removed.

## Note

The formal requirements for a valid notice vary by jurisdiction. Local law may require additional elements or specific procedures — obtain professional advice before relying on this page for a legal claim.`,
  },
];

export function findDefaultLegalPage(slug: string): LegalDocument | undefined {
  return LEGAL_PAGES.find((page) => page.slug === slug);
}
