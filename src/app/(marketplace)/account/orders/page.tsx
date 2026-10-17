import Link from "next/link";
import { Download, FileWarning, Receipt } from "lucide-react";

import { RefundRequestForm } from "@/components/marketplace/order-actions";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requestRefundAction } from "@/lib/payments/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders & downloads" };

const ORDERS_SHOWN = 50;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");

  const orders = await prisma.order.findMany({
    where: { buyerId: user.id },
    orderBy: { createdAt: "desc" },
    take: ORDERS_SHOWN,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      currency: true,
      totalMinor: true,
      createdAt: true,
      paidAt: true,
      isTestMode: true,
      receiptUrl: true,
      refunds: {
        orderBy: { createdAt: "desc" },
        select: { id: true, amountMinor: true, status: true, adminNote: true, createdAt: true },
      },
      items: {
        select: {
          id: true,
          titleSnapshot: true,
          priceMinor: true,
          status: true,
          product: {
            select: {
              slug: true,
              version: true,
              // Only files that are active and cleared for delivery are offered.
              files: {
                where: { isActive: true, scanStatus: { in: ["CLEAN", "SKIPPED"] } },
                orderBy: { createdAt: "desc" },
                select: { id: true, fileName: true, sizeBytes: true },
              },
            },
          },
        },
      },
    },
  });

  if (orders.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No orders yet"
          description="Products you buy appear here with their download links and receipts."
          action={
            <Link href="/browse" className={buttonClass("primary")}>
              Browse the marketplace
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Orders &amp; downloads</h1>
        <p className="muted mt-1 text-[12.5px]">
          Every download link is generated on demand, is tied to your purchase and expires shortly
          after it is issued.
        </p>
      </header>

      {orders.length === ORDERS_SHOWN ? (
        <Alert tone="info">
          Showing your {ORDERS_SHOWN} most recent orders. Contact support if you need an older
          receipt.
        </Alert>
      ) : null}

      {orders.map((order: any) => {
        const unlocked = order.status === "PAID" || order.status === "PARTIALLY_REFUNDED";
        const latestRefund = order.refunds[0] ?? null;
        const refundInFlight =
          latestRefund !== null &&
          ["REQUESTED", "APPROVED", "PROCESSING"].includes(latestRefund.status);

        return (
          <Card key={order.id}>
            <CardHeader
              title={`Order ${order.orderNumber}`}
              description={`${order.createdAt.toISOString().slice(0, 10)} · ${order.items.length} ${order.items.length === 1 ? "item" : "items"} · ${formatMoney(order.totalMinor, order.currency)}`}
              actions={
                <div className="flex items-center gap-1.5">
                  {order.isTestMode ? <Badge tone="caution">Test mode</Badge> : null}
                  <StatusBadge status={order.status} />
                </div>
              }
            />

            <ul className="divide-y divide-line">
              {order.items.map((item: any) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/product/${item.product.slug}`}
                      className="block truncate text-[13px] font-medium text-ink hover:text-accent"
                    >
                      {item.titleSnapshot}
                    </Link>
                    <p className="subtle mt-0.5 text-[11.5px]">
                      v{item.product.version} · {formatMoney(item.priceMinor, order.currency)}
                    </p>
                  </div>

                  {unlocked ? (
                    item.product.files.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {item.product.files.map((file: any) => (
                          <a
                            key={file.id}
                            href={`/api/downloads/${file.id}`}
                            className={buttonClass("secondary", "sm")}
                          >
                            <Download className="size-3.5" aria-hidden />
                            {file.fileName.length > 22
                              ? `${file.fileName.slice(0, 19)}…`
                              : file.fileName}
                            <span className="subtle tabular-nums">({formatBytes(file.sizeBytes)})</span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[11.5px] text-caution">
                        <FileWarning className="size-3.5" aria-hidden />
                        No downloadable file published yet
                      </span>
                    )
                  ) : (
                    <span className="subtle text-[11.5px]">Locked until payment is confirmed</span>
                  )}
                </li>
              ))}
            </ul>

            <CardBody className="flex flex-wrap items-center gap-3 border-t border-line py-3">
              <Link
                href={`/support/new?order=${order.orderNumber}`}
                className="text-[12px] text-ink-muted hover:text-ink"
              >
                Get help with this order
              </Link>
              {order.receiptUrl ? (
                <>
                  <span className="text-line">|</span>
                  <a
                    href={order.receiptUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 text-[12px] text-ink-muted hover:text-ink"
                  >
                    <Receipt className="size-3.5" aria-hidden />
                    Stripe receipt
                  </a>
                </>
              ) : null}

              {unlocked && !refundInFlight ? (
                <div className="w-full">
                  <div className="divider mb-3" />
                  <RefundRequestForm action={requestRefundAction} orderId={order.id} />
                </div>
              ) : null}
            </CardBody>

            {latestRefund ? (
              <div className="border-t border-line px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-medium">
                    Refund {formatMoney(latestRefund.amountMinor, order.currency)}
                  </span>
                  <StatusBadge status={latestRefund.status} />
                  <span className="subtle text-[11.5px]">
                    requested {latestRefund.createdAt.toISOString().slice(0, 10)}
                  </span>
                </div>
                <p className="muted mt-1.5 text-[12px] leading-relaxed">
                  {refundInFlight
                    ? "Platform staff are reviewing this request. A refund is complete only once the payment provider confirms it."
                    : latestRefund.status === "PROCESSED"
                      ? "The provider confirmed this refund. It can take a few business days to appear on your statement."
                      : latestRefund.status === "REJECTED"
                        ? "This request was declined."
                        : "This request was recorded but the provider did not complete it."}
                </p>
                {latestRefund.adminNote ? (
                  <p className="subtle mt-1 text-[11.5px]">Staff note: {latestRefund.adminNote}</p>
                ) : null}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
