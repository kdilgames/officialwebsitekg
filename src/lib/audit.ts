import { headers } from "next/headers";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

/** Request metadata for audit trails. Never used for authorisation. */
export async function getRequestContext(): Promise<RequestContext> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip");
  return {
    ipAddress: ip && ip.length > 0 ? ip.slice(0, 64) : null,
    userAgent: headerList.get("user-agent")?.slice(0, 512) ?? null,
  };
}

export async function recordAudit(params: {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}): Promise<void> {
  const context = await getRequestContext();
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      actorRole: params.actorRole ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      before: params.before,
      after: params.after,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
}

export async function recordModeration(params: {
  moderatorId: string;
  targetType: string;
  targetId: string;
  action: string;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.moderationAction.create({
    data: {
      moderatorId: params.moderatorId,
      targetType: params.targetType,
      targetId: params.targetId,
      action: params.action,
      reason: params.reason ?? null,
      metadata: params.metadata,
    },
  });
}

export async function notify(params: {
  userId: string;
  type: Prisma.NotificationCreateInput["type"];
  title: string;
  body?: string;
  href?: string;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      href: params.href ?? null,
    },
  });
}
