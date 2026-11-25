import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { isMissingSchemaError } from "@/lib/db-compat";
import { isValidLicenseKeyFormat, normalizeLicenseKey } from "@/lib/licenses/keys";
import { extractClientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const verifySchema = z.object({
  key: z.string().trim().min(8).max(64),
  productSlug: z.string().trim().max(120).optional(),
  activate: z.boolean().optional(),
});

/**
 * Public software license verification API for game plugins, Discord bots, and
 * developer tools sold on KDILGAMES.
 *
 * POST /api/licenses/verify
 * Body: { "key": "KDIL-XXXX-XXXX-XXXX-XXXX", "productSlug"?: "...", "activate"?: false }
 */
export async function POST(request: NextRequest) {
  const ip = extractClientIp(request.headers) ?? "unknown";
  const rl = await rateLimit(`license-verify:${ip}`, 60, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { valid: false, error: "Too many verification requests. Slow down." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ valid: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, error: "Invalid verification parameters." }, { status: 400 });
  }

  const normalizedKey = normalizeLicenseKey(parsed.data.key);
  if (!isValidLicenseKeyFormat(normalizedKey)) {
    return NextResponse.json({ valid: false, error: "Malformed license key." }, { status: 400 });
  }

  try {
    const record = await prisma.licenseKey.findUnique({
      where: { key: normalizedKey },
      select: {
        id: true,
        status: true,
        activationsCount: true,
        maxActivations: true,
        createdAt: true,
        product: { select: { slug: true, title: true, licenseType: true } },
      },
    });

    if (!record) {
      return NextResponse.json({ valid: false, error: "License key not found." }, { status: 404 });
    }

    if (parsed.data.productSlug && record.product.slug !== parsed.data.productSlug.toLowerCase()) {
      return NextResponse.json(
        { valid: false, error: "License key does not match this product." },
        { status: 403 },
      );
    }

    if (record.status !== "ACTIVE") {
      return NextResponse.json(
        { valid: false, status: record.status, error: "License key is not active." },
        { status: 403 },
      );
    }

    let activationsCount = record.activationsCount;
    if (parsed.data.activate) {
      if (activationsCount >= record.maxActivations) {
        return NextResponse.json(
          {
            valid: false,
            status: record.status,
            activationsCount,
            maxActivations: record.maxActivations,
            error: "Maximum activations reached for this license key.",
          },
          { status: 403 },
        );
      }
      const updated = await prisma.licenseKey.update({
        where: { id: record.id },
        data: { activationsCount: { increment: 1 }, lastVerifiedAt: new Date() },
        select: { activationsCount: true },
      });
      activationsCount = updated.activationsCount;
    } else {
      await prisma.licenseKey
        .update({
          where: { id: record.id },
          data: { lastVerifiedAt: new Date() },
        })
        .catch(() => undefined);
    }

    return NextResponse.json({
      valid: true,
      status: record.status,
      productSlug: record.product.slug,
      productTitle: record.product.title,
      licenseType: record.product.licenseType,
      activationsCount,
      maxActivations: record.maxActivations,
      issuedAt: record.createdAt.toISOString(),
    });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json(
        { valid: false, error: "License verification service is initializing." },
        { status: 503 },
      );
    }
    throw error;
  }
}
