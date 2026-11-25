import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/resend";
import {
  renderOrderReceiptEmail,
  renderProductApprovedEmail,
  renderProductUpdateEmail,
  renderTicketReplyEmail,
} from "@/lib/email/templates";

/** Sends an order receipt email to the buyer (best-effort, never throws). */
export async function sendOrderReceiptEmail(orderId: string): Promise<void> {
  try {
    const baseSelect = {
      orderNumber: true,
      currency: true,
      subtotalMinor: true,
      discountMinor: true,
      totalMinor: true,
      receiptUrl: true,
      buyer: { select: { email: true, displayName: true, username: true } },
      items: { select: { id: true, titleSnapshot: true, priceMinor: true } },
    };

    const order = await withSchemaFallback(
      () =>
        prisma.order.findUnique({
          where: { id: orderId },
          select: { ...baseSelect, taxMinor: true },
        }),
      async () => {
        const legacy = await prisma.order.findUnique({ where: { id: orderId }, select: baseSelect });
        return legacy ? { ...legacy, taxMinor: 0 } : null;
      },
    );

    if (!order?.buyer?.email) return;

    const licenseRows = await withSchemaFallback(
      () =>
        prisma.licenseKey.findMany({
          where: { orderItemId: { in: order.items.map((item) => item.id) } },
          select: { orderItemId: true, key: true },
        }),
      [],
    );
    const licenseByItemId = new Map(licenseRows.map((row) => [row.orderItemId, row.key]));

    const template = renderOrderReceiptEmail({
      siteUrl: env.siteUrl,
      buyerName: order.buyer.displayName || order.buyer.username,
      orderNumber: order.orderNumber,
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      discountMinor: order.discountMinor,
      taxMinor: order.taxMinor,
      totalMinor: order.totalMinor,
      receiptUrl: order.receiptUrl,
      items: order.items.map((item) => ({
        title: item.titleSnapshot,
        priceMinor: item.priceMinor,
        licenseKey: licenseByItemId.get(item.id) ?? null,
      })),
    });

    await sendEmail({
      to: order.buyer.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (error) {
    console.warn("[email] failed to dispatch order receipt:", error);
  }
}

/** Sends product update release emails to verified buyers (best-effort, bounded fan-out). */
export async function sendProductUpdateEmails(params: {
  buyerIds: string[];
  productTitle: string;
  productSlug: string;
  version: string;
  summary: string;
}): Promise<void> {
  if (params.buyerIds.length === 0) return;

  try {
    const buyers = await prisma.user.findMany({
      where: { id: { in: params.buyerIds.slice(0, 200) }, status: "ACTIVE" },
      select: { email: true },
    });
    const emails = [...new Set(buyers.map((b) => b.email).filter(Boolean))];
    if (emails.length === 0) return;

    const template = renderProductUpdateEmail({
      siteUrl: env.siteUrl,
      productTitle: params.productTitle,
      productSlug: params.productSlug,
      version: params.version,
      summary: params.summary,
    });

    for (const email of emails) {
      await sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    }
  } catch (error) {
    console.warn("[email] failed to dispatch product update emails:", error);
  }
}

/** Sends a product-approved notification email to the seller (best-effort). */
export async function sendProductApprovedEmail(params: {
  sellerUserId: string;
  storeName: string;
  productTitle: string;
  productSlug: string;
}): Promise<void> {
  try {
    const sellerUser = await prisma.user.findUnique({
      where: { id: params.sellerUserId },
      select: { email: true },
    });
    if (!sellerUser?.email) return;

    const template = renderProductApprovedEmail({
      siteUrl: env.siteUrl,
      storeName: params.storeName,
      productTitle: params.productTitle,
      productSlug: params.productSlug,
    });

    await sendEmail({
      to: sellerUser.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (error) {
    console.warn("[email] failed to dispatch product approved email:", error);
  }
}

/** Sends a support ticket reply email to the recipient (best-effort). */
export async function sendTicketReplyEmail(params: {
  recipientEmail: string;
  ticketNumber: string;
  subject: string;
  authorLabel: string;
  replyBody: string;
  hrefPath: string;
}): Promise<void> {
  try {
    const template = renderTicketReplyEmail({
      siteUrl: env.siteUrl,
      ticketNumber: params.ticketNumber,
      subject: params.subject,
      authorLabel: params.authorLabel,
      replyBody: params.replyBody,
      hrefPath: params.hrefPath,
    });

    await sendEmail({
      to: params.recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (error) {
    console.warn("[email] failed to dispatch ticket reply email:", error);
  }
}
