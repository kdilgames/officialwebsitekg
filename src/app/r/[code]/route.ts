import { NextResponse, type NextRequest } from "next/server";

import {
  AFFILIATE_COOKIE_MAX_AGE_SECONDS,
  AFFILIATE_COOKIE_NAME,
  normalizeAffiliateCode,
} from "@/lib/affiliate/rules";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { safeNext } from "@/lib/utils/next";

export const dynamic = "force-dynamic";

/**
 * Referral short-link handler (`/r/CODE?to=/product/slug`).
 * Increments affiliate click count (best-effort) and sets a 30-day attribution cookie.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await context.params;
  const code = normalizeAffiliateCode(rawCode);
  const destination = safeNext(request.nextUrl.searchParams.get("to") ?? "/", "/");
  const redirectUrl = new URL(destination, request.url);

  const response = NextResponse.redirect(redirectUrl, { status: 302 });

  if (code) {
    const account = await withSchemaFallback(
      () =>
        prisma.affiliateAccount.findFirst({
          where: { code, isActive: true },
          select: { id: true },
        }),
      null,
    );

    if (account) {
      await withSchemaFallback(
        () =>
          prisma.affiliateAccount.update({
            where: { id: account.id },
            data: { clicks: { increment: 1 } },
          }),
        null,
      );
    }

    response.cookies.set(AFFILIATE_COOKIE_NAME, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AFFILIATE_COOKIE_MAX_AGE_SECONDS,
    });
  }

  return response;
}
