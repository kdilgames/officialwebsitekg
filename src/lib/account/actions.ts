"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  errorState,
  formToObject,
  successState,
  toFieldErrors,
  type ActionState,
} from "@/lib/action-state";
import { notify, recordAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import {
  AVATARS_BUCKET,
  buildAvatarPath,
  createSignedUploadUrl,
  getUploadedObjectSize,
  publicAvatarUrl,
  removeStorageObject,
  storagePathFromPublicUrl,
  type UploadTicket,
} from "@/lib/storage";
import { accountProfileSchema, sellerApplicationSchema, sellerProfileSchema } from "@/lib/validation";

const ALLOWED_AVATAR_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

function extensionOf(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? (parts.pop() ?? "").toLowerCase() : "";
}

/**
 * Issues a signed upload ticket for the signed-in user's own avatar.
 *
 * The storage path is always namespaced by the user's own id, and the bucket
 * policy re-checks that prefix, so an avatar can never be written over somebody
 * else's object.
 */
export async function requestAvatarUpload(input: {
  fileName: string;
  sizeBytes: number;
}): Promise<UploadTicket> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const limit = await rateLimit(`upload:${user.id}`, 60, 60 * 60);
  if (!limit.ok) {
    return { ok: false, error: "Too many uploads in the last hour. Try again later." };
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "The selected image is empty." };
  }
  if (input.sizeBytes > env.uploads.maxAvatarBytes) {
    return {
      ok: false,
      error: `Images must be smaller than ${Math.round(env.uploads.maxAvatarBytes / (1024 * 1024))} MB.`,
    };
  }

  const extension = extensionOf(input.fileName);
  if (!ALLOWED_AVATAR_EXTENSIONS.has(extension)) {
    return { ok: false, error: "Use a PNG, JPG, WebP, GIF or AVIF image." };
  }

  const path = buildAvatarPath({ ownerId: user.id, fileName: input.fileName });

  try {
    const ticket = await createSignedUploadUrl(AVATARS_BUCKET, path);
    return { ok: true, path: ticket.path, token: ticket.token, bucket: AVATARS_BUCKET };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload could not start." };
  }
}

/**
 * Records a finished avatar upload. The size is read back from storage rather
 * than trusted from the browser, and the previous object is removed.
 */
export async function finalizeAvatarUploadAction(input: { path: string }): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return errorState("Your session expired. Please sign in again.");

  if (!input.path.startsWith(`${user.id}/`)) {
    return errorState("The upload path does not belong to your account.");
  }

  let size: number | null;
  try {
    size = await getUploadedObjectSize(AVATARS_BUCKET, input.path);
  } catch (error) {
    return errorState(error instanceof Error ? error.message : "Could not verify the upload.");
  }
  if (size === null) return errorState("The image did not reach storage. Try again.");

  const url = publicAvatarUrl(input.path);
  const previousUrl = user.avatarUrl;

  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url } });

  const previousPath = previousUrl ? storagePathFromPublicUrl(AVATARS_BUCKET, previousUrl) : null;
  if (previousPath && previousPath !== input.path) {
    await removeStorageObject(AVATARS_BUCKET, previousPath).catch(() => undefined);
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "account.avatar_updated",
    entityType: "User",
    entityId: user.id,
  });

  revalidatePath("/account");
  revalidatePath("/", "layout");
  return successState("Profile picture updated.");
}

export async function updateProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return errorState("Your session expired. Please sign in again.");

  const parsed = accountProfileSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName: parsed.data.displayName,
      bio: parsed.data.bio ?? null,
      country: parsed.data.country ?? null,
      marketingOptIn: parsed.data.marketingOptIn,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "account.profile_updated",
    entityType: "User",
    entityId: user.id,
  });

  revalidatePath("/account");
  revalidatePath("/", "layout");
  return successState("Profile updated.");
}

/**
 * Soft-deletes the account.
 *
 * Orders, payouts and earnings are financial records that must stay auditable,
 * so the profile is closed rather than erased. Access is revoked immediately and
 * the personal fields that are not needed for accounting are cleared. A seller
 * with unsettled money or live listings must contact support first.
 */
export async function deleteAccountAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return errorState("Your session expired. Please sign in again.");

  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== "DELETE") {
    return errorState("Type DELETE exactly to confirm.", {
      confirmation: "Type DELETE to confirm.",
    });
  }

  if (user.role === "ADMIN") {
    return errorState("Administrator accounts cannot be deleted from the account page.");
  }

  if (user.sellerProfile && user.sellerProfile.status === "APPROVED") {
    return errorState(
      "Seller accounts with an active store must be closed by support so that outstanding earnings and refunds are settled first.",
    );
  }

  const openEarnings = await prisma.sellerEarning.count({
    where: {
      seller: { userId: user.id },
      status: { in: ["PENDING", "AVAILABLE"] },
    },
  });
  if (openEarnings > 0) {
    return errorState(
      "You still have earnings that have not been paid out. Contact support so they can be settled before the account is closed.",
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: "DELETED",
      deletedAt: new Date(),
      bio: null,
      avatarUrl: null,
      marketingOptIn: false,
      suspendedReason: "Closed by the account owner.",
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "account.deleted",
    entityType: "User",
    entityId: user.id,
  });

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/?account=closed");
}

/**
 * Applies to become a seller, or re-applies after a rejection.
 *
 * The application is always created (or reset) to PENDING: approval is an
 * administrative action and a seller can never approve their own store.
 */
export async function applyAsSellerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return errorState("Your session expired. Please sign in again.");

  if (!user.emailVerified) {
    return errorState("Verify your email address before applying to sell.");
  }

  const parsed = sellerApplicationSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  const limit = await rateLimit(`seller-apply:${user.id}`, 5, 60 * 60);
  if (!limit.ok) return errorState("Too many attempts. Try again later.");

  const data = parsed.data;

  if (user.sellerProfile) {
    if (user.sellerProfile.status === "APPROVED") {
      return errorState("Your store is already approved.");
    }
    if (user.sellerProfile.status === "SUSPENDED") {
      return errorState("Your store is suspended. Contact support to resolve it.");
    }
    if (user.sellerProfile.status === "PENDING") {
      return errorState("Your application is already under review.");
    }
  }

  const clash = await prisma.sellerProfile.findUnique({
    where: { slug: data.slug },
    select: { userId: true },
  });
  if (clash && clash.userId !== user.id) {
    return errorState("That store URL is taken.", { slug: "This store URL is already in use." });
  }

  const payload = {
    storeName: data.storeName,
    slug: data.slug,
    tagline: data.tagline ?? null,
    about: data.about,
    country: data.country ?? null,
    websiteUrl: data.websiteUrl ?? null,
    supportEmail: data.supportEmail ?? user.email,
    applicationNote: data.applicationNote ?? null,
    status: "PENDING" as const,
    reviewNote: null,
    reviewedAt: null,
    reviewedById: null,
  };

  await prisma.sellerProfile.upsert({
    where: { userId: user.id },
    update: payload,
    create: { userId: user.id, ...payload },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "seller.application_submitted",
    entityType: "SellerProfile",
    entityId: user.id,
    after: { storeName: data.storeName, slug: data.slug },
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  for (const admin of admins) {
    await notify({
      userId: admin.id,
      type: "MODERATION",
      title: "New seller application",
      body: `${data.storeName} (@${user.username}) applied to sell.`,
      href: "/admin/sellers",
    });
  }

  revalidatePath("/account/seller");
  revalidatePath("/", "layout");
  return successState("Application submitted. An administrator will review it.");
}

/**
 * Updates the public store profile. Scoped by the signed-in user's own seller
 * profile, so a seller can only ever edit their own store.
 */
export async function updateSellerProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user?.sellerProfile) return errorState("Only approved sellers can edit a store profile.");
  if (user.sellerProfile.status !== "APPROVED") {
    return errorState("Your store is not approved yet.");
  }

  const parsed = sellerProfileSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  const data = parsed.data;
  if (data.slug !== user.sellerProfile.slug) {
    const clash = await prisma.sellerProfile.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (clash && clash.id !== user.sellerProfile.id) {
      return errorState("That store URL is taken.", { slug: "This store URL is already in use." });
    }
  }

  await prisma.sellerProfile.update({
    where: { id: user.sellerProfile.id },
    data: {
      storeName: data.storeName,
      slug: data.slug,
      tagline: data.tagline ?? null,
      about: data.about,
      websiteUrl: data.websiteUrl ?? null,
      supportEmail: data.supportEmail ?? user.email,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "seller.profile_updated",
    entityType: "SellerProfile",
    entityId: user.sellerProfile.id,
  });

  revalidatePath("/account/seller");
  revalidatePath(`/seller/${data.slug}`);
  revalidatePath("/", "layout");
  return successState("Store profile updated.");
}
