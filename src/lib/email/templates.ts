export function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMinor(minor: number, currency: string): string {
  if (minor === 0) return "Free";
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function wrapLayout(params: { title: string; preheader: string; bodyHtml: string; siteUrl: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;padding:24px;background:#faf9f5;color:#141413;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(params.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e7e5dd;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:20px 24px;border-bottom:1px solid #e7e5dd;background:#141413;color:#faf9f5;">
        <strong style="font-size:15px;letter-spacing:0.04em;">KDILGAMES</strong>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        ${params.bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;border-top:1px solid #e7e5dd;font-size:12px;color:#6f6e66;">
        KDILGAMES Digital Marketplace · Croatia (EU) · <a href="${escapeHtml(params.siteUrl)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(params.siteUrl)}</a>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type OrderReceiptTemplateInput = {
  siteUrl: string;
  buyerName: string;
  orderNumber: string;
  currency: string;
  subtotalMinor: number;
  discountMinor?: number;
  taxMinor?: number;
  totalMinor: number;
  items: Array<{ title: string; priceMinor: number; licenseKey?: string | null }>;
  receiptUrl?: string | null;
};

export function renderOrderReceiptEmail(input: OrderReceiptTemplateInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Receipt for order ${input.orderNumber} — KDILGAMES`;
  const ordersHref = `${input.siteUrl}/account/orders`;

  const rowsHtml = input.items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eceae2;font-size:14px;">
          ${escapeHtml(item.title)}
          ${item.licenseKey ? `<div style="margin-top:4px;font-family:monospace;font-size:12px;color:#2563eb;">License: ${escapeHtml(item.licenseKey)}</div>` : ""}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #eceae2;font-size:14px;text-align:right;white-space:nowrap;">${escapeHtml(formatMinor(item.priceMinor, input.currency))}</td>
      </tr>`,
    )
    .join("");

  const taxRow =
    (input.taxMinor ?? 0) > 0
      ? `<tr><td style="padding:4px 0;font-size:13px;color:#57564f;">EU VAT / Tax</td><td style="padding:4px 0;font-size:13px;text-align:right;">${escapeHtml(formatMinor(input.taxMinor ?? 0, input.currency))}</td></tr>`
      : "";

  const discountRow =
    (input.discountMinor ?? 0) > 0
      ? `<tr><td style="padding:4px 0;font-size:13px;color:#15803d;">Discount</td><td style="padding:4px 0;font-size:13px;color:#15803d;text-align:right;">-${escapeHtml(formatMinor(input.discountMinor ?? 0, input.currency))}</td></tr>`
      : "";

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:20px;">Thanks for your order, ${escapeHtml(input.buyerName)}!</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#57564f;line-height:1.5;">
      Your order <strong>${escapeHtml(input.orderNumber)}</strong> is confirmed and your downloads are unlocked in your account.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
      ${rowsHtml}
      ${discountRow}
      ${taxRow}
      <tr>
        <td style="padding:10px 0 0;font-size:15px;font-weight:600;">Total</td>
        <td style="padding:10px 0 0;font-size:15px;font-weight:600;text-align:right;">${escapeHtml(formatMinor(input.totalMinor, input.currency))}</td>
      </tr>
    </table>
    <p style="margin:20px 0 0;">
      <a href="${escapeHtml(ordersHref)}" style="display:inline-block;padding:10px 18px;background:#141413;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Open downloads</a>
      ${input.receiptUrl ? ` &nbsp;<a href="${escapeHtml(input.receiptUrl)}" style="font-size:13px;color:#2563eb;">Stripe receipt</a>` : ""}
    </p>
  `;

  const textLines = [
    `Thanks for your order, ${input.buyerName}!`,
    `Order: ${input.orderNumber}`,
    "",
    ...input.items.map(
      (i) => `- ${i.title}: ${formatMinor(i.priceMinor, input.currency)}${i.licenseKey ? ` [Key: ${i.licenseKey}]` : ""}`,
    ),
    ...(input.discountMinor ? [`Discount: -${formatMinor(input.discountMinor, input.currency)}`] : []),
    ...(input.taxMinor ? [`VAT / Tax: ${formatMinor(input.taxMinor, input.currency)}`] : []),
    `Total: ${formatMinor(input.totalMinor, input.currency)}`,
    "",
    `Downloads: ${ordersHref}`,
    ...(input.receiptUrl ? [`Stripe receipt: ${input.receiptUrl}`] : []),
  ];

  return {
    subject,
    html: wrapLayout({
      title: subject,
      preheader: `Order ${input.orderNumber} is ready to download.`,
      bodyHtml,
      siteUrl: input.siteUrl,
    }),
    text: textLines.join("\n"),
  };
}

export function renderProductUpdateEmail(input: {
  siteUrl: string;
  productTitle: string;
  productSlug: string;
  version: string;
  summary: string;
}): { subject: string; html: string; text: string } {
  const subject = `New update: ${input.productTitle} v${input.version}`;
  const updateUrl = `${input.siteUrl}/product/${input.productSlug}?tab=updates`;
  const ordersUrl = `${input.siteUrl}/account/orders`;

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:20px;">${escapeHtml(input.productTitle)} v${escapeHtml(input.version)} is out</h1>
    <p style="margin:0 0 14px;font-size:14px;color:#57564f;line-height:1.5;">
      A product you own on KDILGAMES has a new release available in your library.
    </p>
    <div style="padding:12px 14px;background:#faf9f5;border:1px solid #e7e5dd;border-radius:8px;font-size:13.5px;color:#141413;line-height:1.5;">
      ${escapeHtml(input.summary)}
    </div>
    <p style="margin:20px 0 0;">
      <a href="${escapeHtml(ordersUrl)}" style="display:inline-block;padding:10px 18px;background:#141413;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Download update</a>
      &nbsp;<a href="${escapeHtml(updateUrl)}" style="font-size:13px;color:#2563eb;">View changelog</a>
    </p>
  `;

  return {
    subject,
    html: wrapLayout({
      title: subject,
      preheader: `${input.productTitle} v${input.version} is now ready to download.`,
      bodyHtml,
      siteUrl: input.siteUrl,
    }),
    text: [
      `${input.productTitle} v${input.version} is now available.`,
      "",
      input.summary,
      "",
      `Download: ${ordersUrl}`,
      `Changelog: ${updateUrl}`,
    ].join("\n"),
  };
}

export function renderProductApprovedEmail(input: {
  siteUrl: string;
  storeName: string;
  productTitle: string;
  productSlug: string;
}): { subject: string; html: string; text: string } {
  const subject = `Approved: "${input.productTitle}" is now live on KDILGAMES`;
  const productUrl = `${input.siteUrl}/product/${input.productSlug}`;

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:20px;">Your listing is live!</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#57564f;line-height:1.5;">
      Hi ${escapeHtml(input.storeName)}, our moderation team approved <strong>${escapeHtml(input.productTitle)}</strong>. It is now published on the KDILGAMES storefront.
    </p>
    <p style="margin:0;">
      <a href="${escapeHtml(productUrl)}" style="display:inline-block;padding:10px 18px;background:#141413;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">View live listing</a>
    </p>
  `;

  return {
    subject,
    html: wrapLayout({
      title: subject,
      preheader: `${input.productTitle} has been approved and published.`,
      bodyHtml,
      siteUrl: input.siteUrl,
    }),
    text: `Hi ${input.storeName},\n\n"${input.productTitle}" was approved and is now live on KDILGAMES:\n${productUrl}`,
  };
}

export function renderTicketReplyEmail(input: {
  siteUrl: string;
  ticketNumber: string;
  subject: string;
  authorLabel: string;
  replyBody: string;
  hrefPath: string;
}): { subject: string; html: string; text: string } {
  const subject = `[${input.ticketNumber}] New reply: ${input.subject}`;
  const ticketUrl = `${input.siteUrl}${input.hrefPath}`;
  const excerpt = input.replyBody.length > 600 ? `${input.replyBody.slice(0, 597)}…` : input.replyBody;

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:19px;">New reply on ticket ${escapeHtml(input.ticketNumber)}</h1>
    <p style="margin:0 0 12px;font-size:13.5px;color:#57564f;">
      <strong>${escapeHtml(input.authorLabel)}</strong> replied to <em>${escapeHtml(input.subject)}</em>:
    </p>
    <div style="padding:12px 14px;background:#faf9f5;border:1px solid #e7e5dd;border-radius:8px;font-size:13.5px;white-space:pre-wrap;line-height:1.5;">${escapeHtml(excerpt)}</div>
    <p style="margin:20px 0 0;">
      <a href="${escapeHtml(ticketUrl)}" style="display:inline-block;padding:10px 18px;background:#141413;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">View ticket</a>
    </p>
  `;

  return {
    subject,
    html: wrapLayout({
      title: subject,
      preheader: `${input.authorLabel} replied on ${input.ticketNumber}.`,
      bodyHtml,
      siteUrl: input.siteUrl,
    }),
    text: [
      `${input.authorLabel} replied on ticket ${input.ticketNumber} (${input.subject}):`,
      "",
      excerpt,
      "",
      `Open ticket: ${ticketUrl}`,
    ].join("\n"),
  };
}
