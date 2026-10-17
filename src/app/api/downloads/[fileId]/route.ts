import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { createSignedDownloadUrl, type StorageBucket } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entitlement-checked download endpoint.
 *
 * The file id in the URL is never trusted on its own: the query requires an
 * active, scanned file whose product appears on a paid order line belonging to
 * the signed-in buyer. Only then is a short-lived signed URL issued, and the
 * attempt is written to the download history. The bucket is private, so a URL
 * that leaks still expires and cannot be enumerated.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to download your purchases." }, { status: 401 });
  }

  const { fileId } = await context.params;

  const file = await prisma.productFile.findFirst({
    where: {
      id: fileId,
      isActive: true,
      // `PENDING` means scanning has not finished, and `INFECTED`/`FAILED` are
      // never served. `SKIPPED` is only set when no scanner is configured.
      scanStatus: { in: ["CLEAN", "SKIPPED"] },
      product: {
        // A to-many relation filter needs `some`; the ownership check lives
        // here so the query can never return a file the buyer has not paid for.
        orderItems: {
          some: {
            status: "PAID",
            order: { buyerId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
          },
        },
      },
    },
    select: {
      id: true,
      fileName: true,
      storageBucket: true,
      storagePath: true,
      productId: true,
      product: {
        select: {
          // The same paid-order filter is repeated here so the recorded history
          // always points at the order line that granted access.
          orderItems: {
            where: {
              status: "PAID",
              order: { buyerId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
            },
            select: { id: true, orderId: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!file) {
    return NextResponse.json(
      { error: "No paid purchase gives this account access to that file." },
      { status: 403 },
    );
  }

  const entitlement = file.product.orderItems[0];
  if (!entitlement) {
    return NextResponse.json({ error: "Entitlement could not be verified." }, { status: 403 });
  }

  let signedUrl: string;
  try {
    signedUrl = await createSignedDownloadUrl(
      file.storageBucket as StorageBucket,
      file.storagePath,
      300,
      file.fileName,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const requestContext = await getRequestContext();
  await prisma.downloadRecord.create({
    data: {
      userId: user.id,
      orderId: entitlement.orderId,
      orderItemId: entitlement.id,
      productId: file.productId,
      productFileId: file.id,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
    },
  });

  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
