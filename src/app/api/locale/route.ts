import { NextResponse, type NextRequest } from "next/server";

import { LOCALE_COOKIE_NAME, parseLocale } from "@/lib/i18n/config";

export async function POST(request: NextRequest) {
  let rawLocale: string | null = null;
  try {
    const body = (await request.json()) as { locale?: string };
    rawLocale = body.locale ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const locale = parseLocale(rawLocale);
  if (!locale) {
    return NextResponse.json({ error: "Unsupported locale. Use 'en' or 'hr'." }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
