"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { errorState, formToObject, toFieldErrors, type ActionState } from "@/lib/action-state";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isOwner, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { env, isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().email("Enter your account email to confirm."),
  confirmPhrase: z
    .string()
    .trim()
    .refine((val) => val === "DELETE", {
      message: 'Type DELETE in capital letters to confirm account erasure.',
    }),
});

/**
 * GDPR Art. 17 right-to-erasure account deletion.
 *
 * Anonymizes personal identifiers while preserving statutory EU tax/accounting
 * order ledgers (GDPR Art. 17(3)(b)). Removes the Supabase Auth record when
 * `SUPABASE_SERVICE_ROLE_KEY` is configured and signs out the session.
 */
export async function deleteAccountAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/account/privacy");

  if (isOwner(user)) {
    return errorState(
      "The primary platform owner account cannot be self-deleted. Transfer ownership first.",
    );
  }

  const parsed = deleteAccountSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please confirm both fields before deleting your account.", toFieldErrors(parsed.error.issues));
  }

  if (parsed.data.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
    return errorState("Email confirmation does not match your signed-in account.", {
      confirmEmail: "Must match your current account email.",
    });
  }

  const limit = await rateLimit(`gdpr-delete:${user.id}`, 3, 60 * 60);
  if (!limit.ok) {
    return errorState("Too many deletion attempts. Please wait and try again.");
  }

  // Block deletion while active financial disputes or in-flight payouts exist.
  const [openDisputes, processingPayouts] = await Promise.all([
    prisma.dispute.count({
      where: {
        order: { buyerId: user.id },
        status: { in: ["NEEDS_RESPONSE", "UNDER_REVIEW"] },
      },
    }),
    user.sellerProfile
      ? prisma.payout.count({
          where: { sellerId: user.sellerProfile.id, status: { in: ["PENDING", "IN_TRANSIT"] } },
        })
      : Promise.resolve(0),
  ]);

  if (openDisputes > 0) {
    return errorState(
      "You have an open payment dispute. Account erasure can proceed once the dispute is resolved.",
    );
  }
  if (processingPayouts > 0) {
    return errorState(
      "You have a pending or in-transit seller payout. Wait until it completes before deleting your account.",
    );
  }

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, authUserId: true, sellerProfile: { select: { id: true } } },
  });
  if (!fullUser) {
    return errorState("Account not found.");
  }

  const shortToken = user.id.replace(/-/g, "").slice(0, 12);
  const anonymizedEmail = `deleted-${shortToken}@deleted.invalid`;
  const anonymizedUsername = `deleted_${shortToken}`;

  await prisma.$transaction(async (tx) => {
    await tx.wishlistItem.deleteMany({ where: { userId: user.id } });
    await tx.follow.deleteMany({ where: { followerId: user.id } });
    await tx.cart.deleteMany({ where: { userId: user.id } });

    if (fullUser.sellerProfile) {
      await tx.product.updateMany({
        where: { sellerId: fullUser.sellerProfile.id, status: "PUBLISHED" },
        data: { status: "ARCHIVED" },
      });
      await tx.sellerProfile.update({
        where: { id: fullUser.sellerProfile.id },
        data: {
          status: "SUSPENDED",
          storeName: `Closed store (${shortToken})`,
          tagline: null,
          about: null,
          websiteUrl: null,
          supportEmail: null,
        },
      });
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        email: anonymizedEmail,
        username: anonymizedUsername,
        displayName: "Deleted User",
        bio: null,
        avatarUrl: null,
        country: null,
        marketingOptIn: false,
        status: "DELETED",
        role: "USER",
      },
    });
  });

  // Clean optional/newer tables safely (pre-migration tolerant).
  await withSchemaFallback(
    () => prisma.notification.deleteMany({ where: { userId: user.id } }),
    { count: 0 },
  );

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "gdpr.account_deleted",
    entityType: "User",
    entityId: user.id,
  }).catch(() => undefined);

  // Remove Supabase Auth user when service role key is present; always sign out.
  if (isSupabaseAdminConfigured && fullUser.authUserId) {
    try {
      const admin = createClient(
        env.supabase.url as string,
        env.supabase.serviceRoleKey as string,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      await admin.auth.admin.deleteUser(fullUser.authUserId);
    } catch (error) {
      console.warn("[gdpr] failed to delete Supabase auth user:", error);
    }
  }

  if (isSupabaseConfigured) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Session already invalidated or auth unavailable.
    }
  }

  revalidatePath("/", "layout");
  redirect("/?account_deleted=1");
}
