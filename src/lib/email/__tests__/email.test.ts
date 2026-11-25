import { describe, expect, it, vi } from "vitest";

import { sendEmail } from "../resend";
import {
  escapeHtml,
  renderOrderReceiptEmail,
  renderProductApprovedEmail,
  renderProductUpdateEmail,
  renderTicketReplyEmail,
} from "../templates";

describe("Resend client", () => {
  it("skips gracefully when RESEND_API_KEY is unset", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await sendEmail(
      {
        to: "buyer@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
      },
      { apiKey: "" },
    );
    expect(res).toEqual({ ok: true, skipped: true });
    infoSpy.mockRestore();
  });

  it("ignores anonymized deleted.invalid addresses", async () => {
    const mockFetch = vi.fn();
    const res = await sendEmail(
      {
        to: "deleted-abc@deleted.invalid",
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
      },
      { apiKey: "re_test_123", fetchImpl: mockFetch as unknown as typeof fetch },
    );
    expect(res).toEqual({ ok: true, skipped: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts payload to Resend API when configured", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
    );
    const res = await sendEmail(
      {
        to: "buyer@example.com",
        subject: "Receipt",
        html: "<p>Thanks</p>",
        text: "Thanks",
      },
      { apiKey: "re_test_123", from: "KDILGAMES <noreply@kdilgames.com>", fetchImpl: mockFetch as unknown as typeof fetch },
    );
    expect(res).toEqual({ ok: true, id: "email_123" });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("returns ok:false gracefully on provider HTTP errors without throwing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const mockFetch = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    const res = await sendEmail(
      { to: "buyer@example.com", subject: "Test", html: "<p>x</p>", text: "x" },
      { apiKey: "re_test_123", fetchImpl: mockFetch as unknown as typeof fetch },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("429");
    warnSpy.mockRestore();
  });
});

describe("Transactional email templates", () => {
  it("escapes HTML safely in templates", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("renders order receipt with VAT and license key", () => {
    const email = renderOrderReceiptEmail({
      siteUrl: "https://kdilgames.com",
      buyerName: "Luka",
      orderNumber: "ORD-20261125-ABCD",
      currency: "EUR",
      subtotalMinor: 1000,
      taxMinor: 250,
      totalMinor: 1250,
      items: [{ title: "Dungeon System", priceMinor: 1000, licenseKey: "KDIL-AAAA-BBBB-CCCC" }],
    });
    expect(email.subject).toContain("ORD-20261125-ABCD");
    expect(email.html).toContain("KDIL-AAAA-BBBB-CCCC");
    expect(email.html).toContain("EU VAT");
    expect(email.text).toContain("KDIL-AAAA-BBBB-CCCC");
  });

  it("renders product update, approval, and ticket reply emails", () => {
    const update = renderProductUpdateEmail({
      siteUrl: "https://kdilgames.com",
      productTitle: "Admin Panel",
      productSlug: "admin-panel",
      version: "2.1.0",
      summary: "Fixed permissions bug",
    });
    expect(update.subject).toContain("v2.1.0");
    expect(update.html).toContain("/product/admin-panel?tab=updates");

    const approved = renderProductApprovedEmail({
      siteUrl: "https://kdilgames.com",
      storeName: "PixelForge",
      productTitle: "Admin Panel",
      productSlug: "admin-panel",
    });
    expect(approved.subject).toContain("Approved");
    expect(approved.html).toContain("PixelForge");

    const ticket = renderTicketReplyEmail({
      siteUrl: "https://kdilgames.com",
      ticketNumber: "SUP-20261125-1234",
      subject: "Download issue",
      authorLabel: "KDILGAMES Support",
      replyBody: "We refreshed your download token.",
      hrefPath: "/support/SUP-20261125-1234",
    });
    expect(ticket.subject).toContain("SUP-20261125-1234");
    expect(ticket.html).toContain("We refreshed your download token.");
  });
});
