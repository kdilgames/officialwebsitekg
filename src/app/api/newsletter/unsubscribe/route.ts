import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token || token.length < 16) {
    return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  }

  await withSchemaFallback(
    () =>
      prisma.newsletterSubscriber.updateMany({
        where: { unsubscribeToken: token },
        data: { status: "UNSUBSCRIBED" },
      }),
    { count: 0 },
  );

  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:48px auto;padding:16px;color:#141413;"><h1>Unsubscribed</h1><p>You have been removed from the KDILGAMES newsletter.</p><p><a href="/">Return to KDILGAMES</a></p></body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}
