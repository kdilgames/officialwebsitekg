import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { handleStripeEvent } from "@/lib/payments/stripe-events";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verified Stripe webhook.
 *
 * Every request must carry a valid `stripe-signature` computed over the raw
 * body, and the raw body is what gets verified — never a re-serialised object.
 * The event is persisted before it is applied, so a redelivery that Stripe
 * retries after a non-2xx response cannot double-apply a payment: the unique
 * `eventId` makes the second insert fail and the event is acknowledged.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = env.stripe.webhookSecret;

  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Stripe webhooks are not configured on this deployment." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 });
  }

  let recordId: string;
  try {
    const record = await prisma.webhookEvent.create({
      data: {
        provider: "stripe",
        eventId: event.id,
        type: event.type,
        payload: event as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    recordId = record.id;
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw error;
  }

  try {
    const outcome = await handleStripeEvent(event, stripe);

    await prisma.webhookEvent.update({
      where: { id: recordId },
      data: {
        status: outcome.status,
        error: outcome.detail ?? null,
        processedAt: new Date(),
      },
    });

    return NextResponse.json({ received: true, status: outcome.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.webhookEvent.update({
      where: { id: recordId },
      data: { status: "FAILED", error: message.slice(0, 500), processedAt: new Date() },
    });

    // A 5xx tells Stripe to retry with backoff; the stored event lets an
    // administrator see exactly which delivery is still outstanding.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
