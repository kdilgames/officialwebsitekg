import { notify } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import {
  ConnectError,
  createSellerTransfer,
  retrieveConnectStatus,
} from "@/lib/payments/connect";

/**
 * Payout ledger.
 *
 * Earnings are written as PENDING with an `availableAt` date when a payment
 * succeeds. There is no background scheduler in this deployment, so the
 * maturity sweep runs whenever a seller opens their dashboard and before every
 * payout decision. It only ever promotes rows whose hold period has elapsed, so
 * it is safe to call repeatedly.
 */
export async function sweepMaturedEarnings(sellerId?: string): Promise<number> {
  const result = await prisma.sellerEarning.updateMany({
    where: {
      status: "PENDING",
      availableAt: { lte: new Date() },
      ...(sellerId ? { sellerId } : {}),
    },
    data: { status: "AVAILABLE" },
  });

  return result.count;
}

export type PayoutLedgerRow = {
  payoutId: string;
  sellerId: string;
  currency: string;
  amountMinor: number;
  status: string;
};

/**
 * Reserves every currently payable earning for a seller into a single PENDING
 * payout. Reserving (rather than transferring immediately) keeps a human
 * approval step between a buyer's money and a seller's bank account, and stops
 * the same earnings from being claimed by two payouts.
 */
export async function requestSellerPayout(sellerId: string): Promise<PayoutLedgerRow> {
  await sweepMaturedEarnings(sellerId);

  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: {
      id: true,
      payoutCurrency: true,
      stripeAccountId: true,
      stripePayoutsEnabled: true,
      storeName: true,
      userId: true,
    },
  });

  if (!seller) throw new ConnectError("Seller profile not found.");
  if (!seller.stripeAccountId || !seller.stripePayoutsEnabled) {
    throw new ConnectError(
      "Connect a Stripe payout account first. Payouts cannot be requested until Stripe confirms that your account can receive money.",
    );
  }

  const currency = seller.payoutCurrency;

  const available = await prisma.sellerEarning.findMany({
    where: {
      sellerId,
      status: "AVAILABLE",
      payoutId: null,
      currency,
    },
    select: { id: true, netMinor: true },
  });

  const amountMinor = available.reduce((total, earning) => total + earning.netMinor, 0);
  if (amountMinor <= 0) {
    throw new ConnectError(
      "There is no available balance to pay out yet. Sales become payable once the hold period ends.",
    );
  }

  const payout = await prisma.$transaction(async (tx) => {
    const created = await tx.payout.create({
      data: {
        sellerId,
        currency,
        amountMinor,
        status: "PENDING",
        method: "STRIPE_TRANSFER",
      },
      select: { id: true },
    });

    // Only rows that are still free are attached; the `payoutId: null` filter
    // above guarantees a cash sale cannot be reserved twice.
    const attached = await tx.sellerEarning.updateMany({
      where: { id: { in: available.map((earning) => earning.id) }, payoutId: null },
      data: { payoutId: created.id },
    });

    if (attached.count !== available.length) {
      throw new ConnectError("Another payout claimed part of this balance. Reload and try again.");
    }

    return created;
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  for (const admin of admins) {
    await notify({
      userId: admin.id,
      type: "PAYOUT",
      title: "Payout requested",
      body: `${seller.storeName} requested ${formatMoney(amountMinor, currency)}.`,
      href: `/admin/payouts`,
    });
  }

  return {
    payoutId: payout.id,
    sellerId,
    currency,
    amountMinor,
    status: "PENDING",
  };
}

/**
 * Executes a reserved payout through Stripe.
 *
 * The amount is recomputed from the earnings still attached to the payout: if a
 * refund reversed part of the balance after the request, the difference is
 * detected and the transfer is refused rather than silently under- or
 * over-paying the seller.
 */
export async function executePayout(params: {
  payoutId: string;
  adminId: string;
}): Promise<{ transferId: string }> {
  const payout = await prisma.payout.findUnique({
    where: { id: params.payoutId },
    select: {
      id: true,
      sellerId: true,
      currency: true,
      amountMinor: true,
      status: true,
      stripeTransferId: true,
      seller: {
        select: { stripeAccountId: true, stripePayoutsEnabled: true, userId: true, storeName: true },
      },
      earnings: { select: { id: true, netMinor: true, status: true } },
    },
  });

  if (!payout) throw new ConnectError("Payout not found.");
  if (payout.status !== "PENDING") {
    throw new ConnectError(`This payout is already ${payout.status.toLowerCase()}.`);
  }

  const accountId = payout.seller.stripeAccountId;
  if (!accountId) throw new ConnectError("The seller has no connected Stripe account.");

  // Re-verify with Stripe instead of trusting the cached flags on the profile.
  const status = await retrieveConnectStatus(accountId);
  if (!status.payoutsEnabled) {
    throw new ConnectError(
      "Stripe has not enabled payouts for this seller yet; the transfer was not attempted.",
    );
  }

  const payable = payout.earnings.filter((earning) => earning.status !== "REVERSED");
  const recomputed = payable.reduce((total, earning) => total + earning.netMinor, 0);
  if (recomputed !== payout.amountMinor) {
    throw new ConnectError(
      `The balance changed after this payout was requested (${formatMoney(recomputed, payout.currency)} vs ${formatMoney(payout.amountMinor, payout.currency)}). Cancel it and request a new payout.`,
    );
  }

  const { transferId } = await createSellerTransfer({
    accountId,
    amountMinor: payout.amountMinor,
    currency: payout.currency,
    payoutId: payout.id,
    transferGroup: `seller:${payout.sellerId}`,
  });

  await prisma.$transaction([
    prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: "PAID",
        stripeTransferId: transferId,
        processedAt: new Date(),
        initiatedById: params.adminId,
      },
    }),
    prisma.sellerEarning.updateMany({
      // The transfer id lives on the payout, not on every earning: the column is
      // unique and one transfer covers many earnings.
      where: { payoutId: payout.id },
      data: { status: "PAID", transferredAt: new Date() },
    }),
  ]);

  await notify({
    userId: payout.seller.userId,
    type: "PAYOUT",
    title: "Payout sent",
    body: `${formatMoney(payout.amountMinor, payout.currency)} is on its way to your Stripe account.`,
    href: "/dashboard/earnings",
  });

  return { transferId };
}

/** Releases the reserved balance without moving money (rejection or failure). */
export async function cancelPayout(params: {
  payoutId: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  const payout = await prisma.payout.findUnique({
    where: { id: params.payoutId },
    select: { id: true, status: true, sellerId: true, currency: true, amountMinor: true, seller: { select: { userId: true } } },
  });

  if (!payout) throw new ConnectError("Payout not found.");
  if (payout.status !== "PENDING") {
    throw new ConnectError(`Only pending payouts can be canceled; this one is ${payout.status.toLowerCase()}.`);
  }

  await prisma.$transaction([
    prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: "CANCELED",
        failureReason: params.reason,
        processedAt: new Date(),
        initiatedById: params.adminId,
      },
    }),
    prisma.sellerEarning.updateMany({
      where: { payoutId: payout.id },
      data: { payoutId: null },
    }),
  ]);

  await notify({
    userId: payout.seller.userId,
    type: "PAYOUT",
    title: "Payout canceled",
    body: `${formatMoney(payout.amountMinor, payout.currency)} returned to your available balance. Reason: ${params.reason}`,
    href: "/dashboard/earnings",
  });
}
