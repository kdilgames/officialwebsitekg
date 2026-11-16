import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getStudioAppBySlug } from "@/lib/studios/apps";
import {
  getStudioLeaderboard,
  isValidPlayerKey,
  leaderboardSubmissionSchema,
  sanitizeStudioName,
} from "@/lib/studios/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!getStudioAppBySlug(slug)) {
    return NextResponse.json({ error: "Studio app not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const playerKey = url.searchParams.get("playerKey");
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitParam) ? limitParam : 50;

  const snapshot = await getStudioLeaderboard(slug, playerKey, limit);
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!getStudioAppBySlug(slug)) {
    return NextResponse.json({ error: "Studio app not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = leaderboardSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid leaderboard payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const rl = await rateLimit(`studio-lb:${slug}:${data.playerKey}`, 20, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many leaderboard sync requests. Please wait a moment." },
      { status: 429 },
    );
  }

  const cleanName = sanitizeStudioName(data.companyName);
  const techTokensBigInt = BigInt(Math.max(0, Math.floor(data.techTokens)));

  await prisma.studioLeaderboardEntry.upsert({
    where: {
      appSlug_playerKey: {
        appSlug: slug,
        playerKey: data.playerKey,
      },
    },
    create: {
      appSlug: slug,
      playerKey: data.playerKey,
      companyName: cleanName,
      lifetimeEarnings: data.lifetimeEarnings,
      techTokens: techTokensBigInt,
      facilityLevel: data.facilityLevel,
      activeServers: data.activeServers,
      contractsDone: data.contractsDone,
      appVersion: data.appVersion ?? "1.5.0",
    },
    update: {
      companyName: cleanName,
      lifetimeEarnings: data.lifetimeEarnings,
      techTokens: techTokensBigInt,
      facilityLevel: data.facilityLevel,
      activeServers: data.activeServers,
      contractsDone: data.contractsDone,
      appVersion: data.appVersion ?? "1.5.0",
    },
  });

  const snapshot = await getStudioLeaderboard(slug, data.playerKey, 50);
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!getStudioAppBySlug(slug)) {
    return NextResponse.json({ error: "Studio app not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const playerKey = url.searchParams.get("playerKey");
  if (!isValidPlayerKey(playerKey)) {
    return NextResponse.json({ error: "Valid playerKey query param is required." }, { status: 400 });
  }

  const rl = await rateLimit(`studio-lb-del:${slug}:${playerKey}`, 10, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  await prisma.studioLeaderboardEntry.deleteMany({
    where: { appSlug: slug, playerKey },
  });

  const snapshot = await getStudioLeaderboard(slug, undefined, 50);
  return NextResponse.json({ deleted: true, ...snapshot });
}
