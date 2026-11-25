"use server";

import { randomUUID } from "node:crypto";

import { Prisma, type SellerProfile } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  errorState,
  formToObject,
  successState,
  toFieldErrors,
  type ActionState,
  type ConnectActionState,
  type CreateProductDraftResult,
  type PublishProductUpdateResult,
} from "@/lib/action-state";
import { encodeUpdateChangelog, formatVersionNotificationBody } from "@/lib/update-format";
import { notify, recordAudit } from "@/lib/audit";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { sendProductUpdateEmails } from "@/lib/email/notifications";
import { env, isScannerConfigured } from "@/lib/env";
import { triggerFileScan } from "@/lib/scanner";
import { formatMoney, minorUnitFactor } from "@/lib/money";
import { rateLimit } from "@/lib/rate-limit";
import {
  ConnectError,
  MissingStripeAccountError,
  createConnectAccount,
  createOnboardingLink,
  isSupportedConnectCountry,
  retrieveConnectStatus,
} from "@/lib/payments/connect";
import { formatStripeConnectError } from "@/lib/payments/connect-errors";
import { getRequestOrigin } from "@/lib/utils/origin";
import { requestSellerPayout } from "@/lib/payments/payouts";
import {
  AVATARS_BUCKET,
  PRODUCT_FILES_BUCKET,
  PRODUCT_IMAGES_BUCKET,
  buildAvatarPath,
  buildProductFilePath,
  buildProductImagePath,
  createSignedUploadUrl,
  getUploadedObjectSize,
  publicAvatarUrl,
  publicImageUrl,
  removeStorageObject,
  sanitizeFileName,
  storagePathFromPublicUrl,
  type StorageBucket,
  type UploadTicket,
} from "@/lib/storage";
import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_IMAGE_EXTENSIONS,
  extensionOfFileName,
} from "@/lib/upload-rules";
import { bundleSchema, couponSchema, productSchema } from "@/lib/validation";
import { bpsToPercent, formatBps, resolveCommissionRate } from "@/lib/commission";

type SellerGate =
  | { ok: true; user: SessionUser; seller: SellerProfile }
  | { ok: false; error: ActionState };

/**
 * Every seller action funnels through this gate. Authorisation is decided from
 * the session and the database — never from a value posted by the browser.
 */
async function gate(): Promise<SellerGate> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: errorState("Your session expired. Sign in again to continue.") };
  }
  if (!user.sellerProfile || user.sellerProfile.status !== "APPROVED") {
    return {
      ok: false,
      error: errorState("Only approved sellers can manage products and payouts."),
    };
  }
  return { ok: true, user, seller: user.sellerProfile };
}

const MIME_BY_EXTENSION: Record<string, string> = {
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  jar: "application/java-archive",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
};

function extensionOf(fileName: string): string {
  return extensionOfFileName(fileName);
}

/** The MIME type is derived from the extension, never taken from the browser. */
function mimeFor(fileName: string): string {
  return MIME_BY_EXTENSION[extensionOf(fileName)] ?? "application/octet-stream";
}

function emptyToNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function revalidateProduct(productId: string, slug?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${productId}`);
  if (slug) {
    revalidatePath(`/product/${slug}`);
    revalidatePath("/browse");
  }
}

// ---------------------------------------------------------------- products

function parseProduct(formData: FormData) {
  const parsed = productSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      ok: false as const,
      state: errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues)),
    };
  }

  const data = parsed.data;
  if (data.salePrice !== null && data.salePrice !== undefined && data.salePrice >= data.price) {
    return {
      ok: false as const,
      state: errorState("The sale price must be lower than the regular price.", {
        salePrice: "Must be lower than the regular price.",
      }),
    };
  }

  const factor = minorUnitFactor(data.currency);
  return {
    ok: true as const,
    data,
    priceMinor: Math.round(data.price * factor),
    salePriceMinor:
      data.salePrice !== null && data.salePrice !== undefined
        ? Math.round(data.salePrice * factor)
        : null,
  };
}

export async function saveProductDraftForUploadAction(
  formData: FormData,
  existingProductId?: string,
): Promise<CreateProductDraftResult> {
  const access = await gate();
  if (!access.ok) return { ok: false, state: access.error };
  const { user, seller } = access;

  const parsed = parseProduct(formData);
  if (!parsed.ok) return { ok: false, state: parsed.state };
  const { data, priceMinor, salePriceMinor } = parsed;

  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, isActive: true },
    select: { id: true },
  });
  if (!category) {
    return {
      ok: false,
      state: errorState("Pick an active category.", { categoryId: "Unknown category." }),
    };
  }

  if (existingProductId) {
    const existing = await prisma.product.findFirst({
      where: { id: existingProductId, sellerId: seller.id },
      select: {
        id: true,
        slug: true,
        status: true,
        version: true,
        versions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
      },
    });
    if (!existing) {
      return { ok: false, state: errorState("Draft product not found in your store.") };
    }
    if (existing.status !== "DRAFT") {
      return {
        ok: false,
        state: errorState("This listing is no longer in draft state."),
      };
    }

    if (data.slug !== existing.slug) {
      const clash = await prisma.product.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });
      if (clash) {
        return {
          ok: false,
          state: errorState("That listing page link slug is already in use.", {
            slug: "Already in use.",
          }),
        };
      }
    }

    await prisma.product.update({
      where: { id: existing.id },
      data: {
        categoryId: category.id,
        title: data.title,
        slug: data.slug,
        shortDescription: data.shortDescription,
        description: data.description,
        priceMinor,
        salePriceMinor,
        currency: data.currency,
        tags: data.tags,
        version: data.version,
        licenseType: data.licenseType,
        licenseText: emptyToNull(data.licenseText),
        demoUrl: emptyToNull(data.demoUrl),
        videoUrl: emptyToNull(data.videoUrl),
        compatibility: data.compatibility ? data.compatibility : Prisma.DbNull,
        requirements: data.requirements ? data.requirements : Prisma.DbNull,
      },
    });

    const latestVersion = existing.versions[0] ?? null;
    if (latestVersion && existing.version !== data.version) {
      await prisma.productVersion
        .update({
          where: { id: latestVersion.id },
          data: { version: data.version },
        })
        .catch(() => undefined);
    }

    revalidateProduct(existing.id, data.slug);
    return { ok: true, productId: existing.id, versionId: latestVersion?.id ?? null };
  }

  const clash = await prisma.product.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (clash) {
    return {
      ok: false,
      state: errorState("That listing page link slug is already in use.", {
        slug: "Already in use.",
      }),
    };
  }

  const created = await prisma.product.create({
    data: {
      sellerId: seller.id,
      categoryId: category.id,
      title: data.title,
      slug: data.slug,
      shortDescription: data.shortDescription,
      description: data.description,
      priceMinor,
      salePriceMinor,
      currency: data.currency,
      status: "DRAFT",
      tags: data.tags,
      version: data.version,
      licenseType: data.licenseType,
      licenseText: emptyToNull(data.licenseText),
      demoUrl: emptyToNull(data.demoUrl),
      videoUrl: emptyToNull(data.videoUrl),
      compatibility: data.compatibility ? data.compatibility : Prisma.DbNull,
      requirements: data.requirements ? data.requirements : Prisma.DbNull,
    },
    select: { id: true },
  });

  const versionRow = await prisma.productVersion.create({
    data: {
      productId: created.id,
      version: data.version,
      changelog: "Initial release.",
      isLatest: true,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.created",
    entityType: "Product",
    entityId: created.id,
    after: { title: data.title, slug: data.slug, priceMinor },
  });

  revalidateProduct(created.id, data.slug);
  return { ok: true, productId: created.id, versionId: versionRow.id };
}

export async function createProductAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await saveProductDraftForUploadAction(formData);
  if (!result.ok) return result.state;
  redirect(`/dashboard/products/${result.productId}`);
}

export async function updateProductAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user, seller } = access;

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return errorState("Missing product.");

  const existing = await prisma.product.findFirst({
    where: { id: productId, sellerId: seller.id },
    select: { id: true, status: true, slug: true, title: true },
  });
  if (!existing) return errorState("Product not found in your store.");

  const parsed = parseProduct(formData);
  if (!parsed.ok) return parsed.state;
  const { data, priceMinor, salePriceMinor } = parsed;

  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, isActive: true },
    select: { id: true },
  });
  if (!category) return errorState("Pick an active category.", { categoryId: "Unknown category." });

  if (data.slug !== existing.slug) {
    const clash = await prisma.product.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (clash) {
      return errorState("That listing page link slug is already in use.", {
        slug: "Already in use.",
      });
    }
  }

  // A seller may never approve their own listing: editing a live product sends
  // it back for review instead of leaving it published with new content.
  const status = existing.status === "PUBLISHED" ? "PENDING_REVIEW" : existing.status;

  await prisma.product.update({
    where: { id: existing.id },
    data: {
      categoryId: category.id,
      title: data.title,
      slug: data.slug,
      shortDescription: data.shortDescription,
      description: data.description,
      priceMinor,
      salePriceMinor,
      currency: data.currency,
      tags: data.tags,
      licenseType: data.licenseType,
      licenseText: emptyToNull(data.licenseText),
      demoUrl: emptyToNull(data.demoUrl),
      videoUrl: emptyToNull(data.videoUrl),
      compatibility: data.compatibility ? data.compatibility : Prisma.DbNull,
      requirements: data.requirements ? data.requirements : Prisma.DbNull,
      status,
      submittedAt: status === "PENDING_REVIEW" ? new Date() : undefined,
      rejectionReason: null,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.updated",
    entityType: "Product",
    entityId: existing.id,
    before: { title: existing.title, status: existing.status },
    after: { title: data.title, status },
  });

  revalidateProduct(existing.id, data.slug);
  return successState(
    status === "PENDING_REVIEW" && existing.status === "PUBLISHED"
      ? "Saved. Because the listing changed, it goes back to review before it is live again."
      : "Product saved.",
  );
}

async function submitProductForReviewInternal(
  access: Extract<SellerGate, { ok: true }>,
  productId: string,
): Promise<ActionState> {
  const { user, seller } = access;
  const product = await prisma.product.findFirst({
    where: { id: productId, sellerId: seller.id },
    select: {
      id: true,
      slug: true,
      status: true,
      _count: { select: { files: { where: { isActive: true } }, images: true } },
    },
  });
  if (!product) return errorState("Product not found in your store.");
  if (product.status === "PUBLISHED" || product.status === "PENDING_REVIEW") {
    return errorState("Listing is already submitted or live.");
  }
  if (product.status === "SUSPENDED") {
    return errorState("Suspended listings cannot be submitted.");
  }

  if (product._count.files === 0) {
    // There is nothing to deliver, so it must not go live.
    return errorState("Attach at least one file before submitting for review.");
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { status: "PENDING_REVIEW", submittedAt: new Date(), rejectionReason: null },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.submitted",
    entityType: "Product",
    entityId: product.id,
    after: { status: "PENDING_REVIEW" },
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  for (const admin of admins) {
    await notify({
      userId: admin.id,
      type: "MODERATION",
      title: "Product awaiting review",
      body: `${seller.storeName} submitted a product for approval.`,
      href: `/admin/products`,
    });
  }

  revalidateProduct(product.id, product.slug);
  return successState("Listing submitted for admin review.");
}

export async function submitCreatedProductForReviewAction(productId: string): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  return submitProductForReviewInternal(access, productId);
}

export async function submitProductForReviewAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const productId = String(formData.get("productId") ?? "");
  await submitProductForReviewInternal(access, productId);
}

export async function archiveProductAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user, seller } = access;

  const productId = String(formData.get("productId") ?? "");
  const product = await prisma.product.findFirst({
    where: { id: productId, sellerId: seller.id },
    select: { id: true, slug: true, status: true },
  });
  if (!product) return;
  if (product.status === "ARCHIVED" || product.status === "SUSPENDED") return;

  await prisma.product.update({ where: { id: product.id }, data: { status: "ARCHIVED" } });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.archived",
    entityType: "Product",
    entityId: product.id,
    before: { status: product.status },
    after: { status: "ARCHIVED" },
  });

  revalidateProduct(product.id, product.slug);
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user, seller } = access;

  const productId = String(formData.get("productId") ?? "");
  const product = await prisma.product.findFirst({
    where: { id: productId, sellerId: seller.id },
    select: {
      id: true,
      slug: true,
      status: true,
      salesCount: true,
      images: { select: { url: true } },
      files: { select: { storageBucket: true, storagePath: true } },
    },
  });
  if (!product) return;

  // A product somebody paid for is never deleted: buyers keep their download.
  if (product.salesCount > 0) return;
  if (!["DRAFT", "REJECTED", "ARCHIVED"].includes(product.status)) return;

  await prisma.product.delete({ where: { id: product.id } });

  const filePaths = product.files
    .filter((file: any) => file.storageBucket === PRODUCT_FILES_BUCKET)
    .map((file: any) => file.storagePath);
  await Promise.all(
    filePaths.map((path: any) => removeStorageObject(PRODUCT_FILES_BUCKET, path).catch(() => undefined)),
  );

  const imagePaths = product.images
    .map((image: any) => image.url.split(`/${PRODUCT_IMAGES_BUCKET}/`)[1])
    .filter((path: any): path is string => Boolean(path));
  await Promise.all(
    imagePaths.map((path: any) => removeStorageObject(PRODUCT_IMAGES_BUCKET, decodeURIComponent(path)).catch(() => undefined)),
  );

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.deleted",
    entityType: "Product",
    entityId: product.id,
    before: { slug: product.slug, status: product.status },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
}

// ---------------------------------------------------------------- versions

export async function createVersionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user, seller } = access;

  const productId = String(formData.get("productId") ?? "");
  const version = String(formData.get("version") ?? "").trim();
  const updateTitle = String(formData.get("updateTitle") ?? "").trim();
  const changelog = String(formData.get("changelog") ?? "").trim();

  if (!/^[0-9A-Za-z.\-+]{1,32}$/.test(version)) {
    return errorState("Use a version such as 1.2.0.", { version: "Invalid version." });
  }
  if (updateTitle.length > 140) {
    return errorState("Update title must be 140 characters or shorter.", {
      updateTitle: "140 characters max.",
    });
  }
  if (changelog.length < 3 || changelog.length > 8000) {
    return errorState("Describe what changed (3–8000 characters).", {
      changelog: "Describe what changed.",
    });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, sellerId: seller.id },
    select: { id: true, slug: true, title: true, status: true },
  });
  if (!product) return errorState("Product not found in your store.");

  const clash = await prisma.productVersion.findUnique({
    where: { productId_version: { productId: product.id, version } },
    select: { id: true },
  });
  if (clash) return errorState("That version already exists.", { version: "Already published." });

  const encodedChangelog = encodeUpdateChangelog(updateTitle, changelog);

  await prisma.$transaction([
    prisma.productVersion.updateMany({
      where: { productId: product.id },
      data: { isLatest: false },
    }),
    prisma.productVersion.create({
      data: { productId: product.id, version, changelog: encodedChangelog, isLatest: true },
    }),
    prisma.product.update({
      where: { id: product.id },
      data: { version, updatedAt: new Date() },
    }),
  ]);

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.version.created",
    entityType: "Product",
    entityId: product.id,
    after: { version },
  });

  const buyers = await prisma.orderItem.findMany({
    where: {
      productId: product.id,
      status: "PAID",
      order: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
    },
    select: { order: { select: { buyerId: true } } },
  });
  const buyerIds = [...new Set(buyers.map((row) => row.order.buyerId))].filter(
    (id) => id !== user.id,
  );
  if (buyerIds.length > 0) {
    const updateBody = formatVersionNotificationBody(encodedChangelog, version);
    await prisma.notification.createMany({
      data: buyerIds.map((buyerId) => ({
        userId: buyerId,
        type: "ORDER",
        title: `Update: ${product.title} v${version}`,
        body: updateBody,
        href:
          product.status === "PUBLISHED"
            ? `/product/${product.slug}?tab=updates`
            : "/account/orders",
      })),
    });
    await sendProductUpdateEmails({
      buyerIds,
      productTitle: product.title,
      productSlug: product.slug,
      version,
      summary: updateBody,
    });
  }

  revalidateProduct(product.id, product.slug);
  revalidatePath("/account/orders");
  return successState(`Version ${version} published. Existing buyers can download it.`);
}

export async function publishProductUpdateFromPageAction(input: {
  productId: string;
  version: string;
  postUpdate: boolean;
  updateTitle?: string;
  updateMessage?: string;
}): Promise<PublishProductUpdateResult> {
  const access = await gate();
  if (!access.ok) return { ok: false, state: access.error };
  const { user, seller } = access;

  const version = input.version.trim();
  const updateTitle = (input.updateTitle ?? "").trim();
  const updateMessage = (input.updateMessage ?? "").trim();

  if (!/^[0-9A-Za-z.\-+]{1,32}$/.test(version)) {
    return {
      ok: false,
      state: errorState("Use a version number such as 1.2.0 or 4.1.", {
        version: "Use 1–32 letters, digits, dots, hyphens, or +.",
      }),
    };
  }

  if (updateTitle.length > 140) {
    return {
      ok: false,
      state: errorState("Update title must be 140 characters or shorter.", {
        updateTitle: "140 characters max.",
      }),
    };
  }

  if (updateMessage.length > 8000) {
    return {
      ok: false,
      state: errorState("Update message must be 8000 characters or shorter.", {
        updateMessage: "8000 characters max.",
      }),
    };
  }

  if (input.postUpdate && updateTitle.length < 3 && updateMessage.length < 3) {
    return {
      ok: false,
      state: errorState("Add an update title or update message (at least 3 characters).", {
        updateMessage: "Add an update title or message.",
      }),
    };
  }

  const product = await prisma.product.findFirst({
    where: { id: input.productId, sellerId: seller.id },
    select: { id: true, slug: true, title: true, status: true },
  });
  if (!product) {
    return { ok: false, state: errorState("Product not found in your store.") };
  }

  const clash = await prisma.productVersion.findUnique({
    where: { productId_version: { productId: product.id, version } },
    select: { id: true },
  });
  if (clash) {
    return {
      ok: false,
      state: errorState(`Version ${version} already exists.`, {
        version: "Already published.",
      }),
    };
  }

  const encodedChangelog = input.postUpdate
    ? encodeUpdateChangelog(updateTitle, updateMessage)
    : encodeUpdateChangelog(updateTitle || `Release v${version}`, updateMessage);

  const [, createdVersion] = await prisma.$transaction([
    prisma.productVersion.updateMany({
      where: { productId: product.id },
      data: { isLatest: false },
    }),
    prisma.productVersion.create({
      data: {
        productId: product.id,
        version,
        changelog: encodedChangelog,
        isLatest: true,
      },
      select: { id: true },
    }),
    prisma.product.update({
      where: { id: product.id },
      data: { version, updatedAt: new Date() },
    }),
  ]);

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.version.created",
    entityType: "Product",
    entityId: product.id,
    after: { version, postUpdate: input.postUpdate },
  });

  const buyers = await prisma.orderItem.findMany({
    where: {
      productId: product.id,
      status: "PAID",
      order: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
    },
    select: { order: { select: { buyerId: true } } },
  });
  const buyerIds = [...new Set(buyers.map((row) => row.order.buyerId))].filter(
    (id) => id !== user.id,
  );
  if (buyerIds.length > 0) {
    const updateBody = formatVersionNotificationBody(encodedChangelog, version);
    await prisma.notification.createMany({
      data: buyerIds.map((buyerId) => ({
        userId: buyerId,
        type: "ORDER",
        title: `Update: ${product.title} v${version}`,
        body: updateBody,
        href:
          product.status === "PUBLISHED"
            ? `/product/${product.slug}?tab=updates`
            : "/account/orders",
      })),
    });
    await sendProductUpdateEmails({
      buyerIds,
      productTitle: product.title,
      productSlug: product.slug,
      version,
      summary: updateBody,
    });
  }

  revalidateProduct(product.id, product.slug);
  revalidatePath("/account/orders");
  return { ok: true, versionId: createdVersion.id };
}

// ---------------------------------------------------------------- uploads

/**
 * Issues a short-lived signed upload URL. The storage path is generated on the
 * server from the seller id, product id and a fresh UUID, so a client can never
 * choose where its bytes land.
 */
export async function requestProductFileUpload(input: {
  productId: string;
  fileName: string;
  sizeBytes: number;
}): Promise<UploadTicket> {
  const access = await gate();
  if (!access.ok) return { ok: false, error: access.error.message ?? "Not authorised." };
  const { user, seller } = access;

  const limit = await rateLimit(`upload:${user.id}`, 60, 60 * 60);
  if (!limit.ok) {
    return { ok: false, error: "Too many uploads in the last hour. Try again later." };
  }

  const product = await prisma.product.findFirst({
    where: { id: input.productId, sellerId: seller.id },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "Product not found in your store." };

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "The selected file is empty." };
  }
  if (input.sizeBytes > env.uploads.maxFileBytes) {
    return {
      ok: false,
      error: `Files must be smaller than ${Math.round(env.uploads.maxFileBytes / (1024 * 1024))} MB.`,
    };
  }

  const extension = extensionOf(input.fileName);
  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      error: extension
        ? `“.${extension}” files are not accepted. Upload an archive or a supported asset.`
        : "The file needs a recognisable extension, for example .zip.",
    };
  }

  const fileId = randomUUID();
  const path = buildProductFilePath({
    sellerId: seller.id,
    productId: product.id,
    fileId,
    fileName: input.fileName,
  });

  try {
    const ticket = await createSignedUploadUrl(PRODUCT_FILES_BUCKET, path);
    return { ok: true, path: ticket.path, token: ticket.token, bucket: PRODUCT_FILES_BUCKET };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload could not start." };
  }
}

/**
 * Records the uploaded object in the database. The size is read back from
 * storage, and the file is marked as unscanned because this deployment has no
 * malware scanner — the storefront says so rather than claiming otherwise.
 */
export async function finalizeProductFileAction(input: {
  productId: string;
  path: string;
  fileName: string;
  versionId?: string | null;
  note?: string;
  replacePreviousFiles?: boolean;
}): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user, seller } = access;

  const product = await prisma.product.findFirst({
    where: { id: input.productId, sellerId: seller.id },
    select: { id: true, slug: true },
  });
  if (!product) return errorState("Product not found in your store.");

  const prefix = `${seller.id}/${product.id}/`;
  if (!input.path.startsWith(prefix)) {
    return errorState("The upload path does not belong to this product.");
  }

  // Rebuild the canonical path so a tampered value cannot point elsewhere.
  const segments = input.path.slice(prefix.length).split("/");
  const fileId = segments[0];
  const name = segments.slice(1).join("/");
  if (!fileId || !name) return errorState("Malformed upload path.");

  const canonicalPath = buildProductFilePath({
    sellerId: seller.id,
    productId: product.id,
    fileId,
    fileName: name,
  });

  let sizeBytes: number | null;
  try {
    sizeBytes = await getUploadedObjectSize(PRODUCT_FILES_BUCKET, canonicalPath);
  } catch (error) {
    return errorState(error instanceof Error ? error.message : "Could not verify the upload.");
  }
  if (sizeBytes === null) {
    return errorState("The upload did not reach storage. Try uploading again.");
  }

  let versionId: string | null = null;
  if (input.versionId) {
    const version = await prisma.productVersion.findFirst({
      where: { id: input.versionId, productId: product.id },
      select: { id: true },
    });
    versionId = version?.id ?? null;
  }

  const file = await prisma.$transaction(async (tx) => {
    const created = await tx.productFile.create({
      data: {
        productId: product.id,
        versionId,
        storageBucket: PRODUCT_FILES_BUCKET,
        storagePath: canonicalPath,
        fileName: sanitizeFileName(name),
        sizeBytes,
        mimeType: mimeFor(name),
        scanStatus: isScannerConfigured ? "PENDING" : "SKIPPED",
        scanNote: isScannerConfigured
          ? "Automated scan initiated. Results will appear shortly."
          : "No malware scanner is configured on this deployment, so this file was not scanned. The seller is responsible for its contents.",
        isActive: true,
      },
      select: { id: true },
    });

    if (input.replacePreviousFiles) {
      await tx.productFile.updateMany({
        where: { productId: product.id, id: { not: created.id }, isActive: true },
        data: { isActive: false },
      });
    }

    return created;
  });

  if (isScannerConfigured) {
    await triggerFileScan(file.id);
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.file.uploaded",
    entityType: "ProductFile",
    entityId: file.id,
    after: {
      productId: product.id,
      fileName: sanitizeFileName(name),
      sizeBytes,
      version: input.note ?? null,
      replacePreviousFiles: Boolean(input.replacePreviousFiles),
    },
  });

  revalidateProduct(product.id, product.slug);
  return successState("File attached.");
}

export async function deleteProductFileAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user, seller } = access;

  const fileId = String(formData.get("fileId") ?? "");
  const file = await prisma.productFile.findFirst({
    where: { id: fileId, product: { sellerId: seller.id } },
    select: {
      id: true,
      productId: true,
      storageBucket: true,
      storagePath: true,
      _count: { select: { downloads: true } },
      product: { select: { slug: true } },
    },
  });
  if (!file) return;

  if (file._count.downloads > 0) {
    // Buyers already hold links to this object; keep the bytes and hide the file
    // from new purchases instead of destroying a delivered product.
    await prisma.productFile.update({ where: { id: file.id }, data: { isActive: false } });
  } else {
    await prisma.productFile.delete({ where: { id: file.id } });
    await removeStorageObject(
      file.storageBucket as StorageBucket,
      file.storagePath,
    ).catch(() => undefined);
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.file.removed",
    entityType: "ProductFile",
    entityId: file.id,
  });

  revalidateProduct(file.productId, file.product.slug);
}

export async function requestProductImageUpload(input: {
  productId: string;
  fileName: string;
  sizeBytes: number;
}): Promise<UploadTicket> {
  const access = await gate();
  if (!access.ok) return { ok: false, error: access.error.message ?? "Not authorised." };
  const { seller } = access;

  const product = await prisma.product.findFirst({
    where: { id: input.productId, sellerId: seller.id },
    select: { id: true, _count: { select: { images: true } } },
  });
  if (!product) return { ok: false, error: "Product not found in your store." };

  if (product._count.images >= env.uploads.maxImagesPerProduct) {
    return {
      ok: false,
      error: `A listing can hold ${env.uploads.maxImagesPerProduct} images. Remove one first.`,
    };
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "The selected image is empty." };
  }
  if (input.sizeBytes > env.uploads.maxImageBytes) {
    return {
      ok: false,
      error: `Images must be smaller than ${Math.round(env.uploads.maxImageBytes / (1024 * 1024))} MB.`,
    };
  }

  const extension = extensionOf(input.fileName);
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return { ok: false, error: "Use a PNG, JPG, WebP, GIF or AVIF image." };
  }

  const path = buildProductImagePath({
    sellerId: seller.id,
    productId: product.id,
    fileName: input.fileName,
  });

  try {
    const ticket = await createSignedUploadUrl(PRODUCT_IMAGES_BUCKET, path);
    return { ok: true, path: ticket.path, token: ticket.token, bucket: PRODUCT_IMAGES_BUCKET };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload could not start." };
  }
}

export async function finalizeProductImageAction(input: {
  productId: string;
  path: string;
  alt?: string;
}): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user, seller } = access;

  const product = await prisma.product.findFirst({
    where: { id: input.productId, sellerId: seller.id },
    select: { id: true, slug: true, thumbnailUrl: true, _count: { select: { images: true } } },
  });
  if (!product) return errorState("Product not found in your store.");

  const prefix = `${seller.id}/${product.id}/`;
  if (!input.path.startsWith(prefix)) {
    return errorState("The upload path does not belong to this product.");
  }

  let size: number | null;
  try {
    size = await getUploadedObjectSize(PRODUCT_IMAGES_BUCKET, input.path);
  } catch (error) {
    return errorState(error instanceof Error ? error.message : "Could not verify the upload.");
  }
  if (size === null) return errorState("The image did not reach storage. Try again.");

  const url = publicImageUrl(input.path);

  await prisma.$transaction([
    prisma.productImage.create({
      data: {
        productId: product.id,
        url,
        alt: input.alt?.slice(0, 160) ?? null,
        sortOrder: product._count.images,
      },
    }),
    ...(product.thumbnailUrl
      ? []
      : [prisma.product.update({ where: { id: product.id }, data: { thumbnailUrl: url } })]),
  ]);

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.image.uploaded",
    entityType: "Product",
    entityId: product.id,
    after: { url },
  });

  revalidateProduct(product.id, product.slug);
  return successState("Image added.");
}

export async function deleteProductImageAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user, seller } = access;

  const imageId = String(formData.get("imageId") ?? "");
  const image = await prisma.productImage.findFirst({
    where: { id: imageId, product: { sellerId: seller.id } },
    select: {
      id: true,
      url: true,
      productId: true,
      product: { select: { slug: true, thumbnailUrl: true } },
    },
  });
  if (!image) return;

  const next = await prisma.productImage.findFirst({
    where: { productId: image.productId, id: { not: image.id } },
    orderBy: { sortOrder: "asc" },
    select: { url: true },
  });

  await prisma.$transaction([
    prisma.productImage.delete({ where: { id: image.id } }),
    ...(image.product.thumbnailUrl === image.url
      ? [
          prisma.product.update({
            where: { id: image.productId },
            data: { thumbnailUrl: next?.url ?? null },
          }),
        ]
      : []),
  ]);

  const storagePath = image.url.split(`/${PRODUCT_IMAGES_BUCKET}/`)[1];
  if (storagePath) {
    await removeStorageObject(PRODUCT_IMAGES_BUCKET, decodeURIComponent(storagePath)).catch(
      () => undefined,
    );
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.image.removed",
    entityType: "Product",
    entityId: image.productId,
  });

  revalidateProduct(image.productId, image.product.slug);
}

export async function setThumbnailAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { seller } = access;

  const imageId = String(formData.get("imageId") ?? "");
  const image = await prisma.productImage.findFirst({
    where: { id: imageId, product: { sellerId: seller.id } },
    select: { url: true, productId: true, product: { select: { slug: true } } },
  });
  if (!image) return;

  await prisma.product.update({
    where: { id: image.productId },
    data: { thumbnailUrl: image.url },
  });

  revalidateProduct(image.productId, image.product.slug);
}

// ---------------------------------------------------------------- store logo

/**
 * Store logos and personal avatars share the public `avatars` bucket. The path
 * is namespaced by the seller id, which is what the bucket policy checks.
 */
export async function requestStoreLogoUpload(input: {
  fileName: string;
  sizeBytes: number;
}): Promise<UploadTicket> {
  const access = await gate();
  if (!access.ok) return { ok: false, error: access.error.message ?? "Not authorised." };
  const { user, seller } = access;

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
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return { ok: false, error: "Use a PNG, JPG, WebP, GIF or AVIF image." };
  }

  const path = buildAvatarPath({ ownerId: seller.id, fileName: input.fileName });

  try {
    const ticket = await createSignedUploadUrl(AVATARS_BUCKET, path);
    return { ok: true, path: ticket.path, token: ticket.token, bucket: AVATARS_BUCKET };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload could not start." };
  }
}

export async function finalizeStoreLogoAction(input: { path: string }): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user, seller } = access;

  const prefix = `${seller.id}/`;
  if (!input.path.startsWith(prefix)) {
    return errorState("The upload path does not belong to your store.");
  }

  let size: number | null;
  try {
    size = await getUploadedObjectSize(AVATARS_BUCKET, input.path);
  } catch (error) {
    return errorState(error instanceof Error ? error.message : "Could not verify the upload.");
  }
  if (size === null) return errorState("The image did not reach storage. Try again.");

  const url = publicAvatarUrl(input.path);
  const previousUrl = seller.logoUrl;

  await prisma.sellerProfile.update({ where: { id: seller.id }, data: { logoUrl: url } });

  const previousPath = previousUrl
    ? storagePathFromPublicUrl(AVATARS_BUCKET, previousUrl)
    : null;
  if (previousPath && previousPath !== input.path) {
    await removeStorageObject(AVATARS_BUCKET, previousPath).catch(() => undefined);
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "seller.logo.updated",
    entityType: "SellerProfile",
    entityId: seller.id,
    after: { url },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath(`/seller/${seller.slug}`);
  revalidatePath("/", "layout");
  return successState("Store logo updated.");
}

// ---------------------------------------------------------------- Stripe Connect

export async function startConnectOnboardingAction(
  _previous: ConnectActionState,
  _formData: FormData,
): Promise<ConnectActionState> {
  const access = await gate();
  if (!access.ok) {
    return {
      status: "error",
      message: access.error.message ?? "Only approved sellers can connect a payout account.",
    };
  }
  const { user, seller } = access;

  const country = (seller.country ?? user.country ?? "").trim().toUpperCase();
  if (!isSupportedConnectCountry(country)) {
    return {
      status: "error",
      message:
        "Add your two-letter ISO country code (for example HR, US, GB, or DE) in Store profile and save it before connecting Stripe.",
    };
  }

  const origin = await getRequestOrigin();

  async function provisionExpressAccount(): Promise<string> {
    const newAccountId = await createConnectAccount({
      sellerId: seller.id,
      email: user.email,
      country,
      storeName: seller.storeName,
    });
    await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: {
        stripeAccountId: newAccountId,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        stripeOnboardedAt: null,
      },
    });
    return newAccountId;
  }

  try {
    let accountId = seller.stripeAccountId;
    if (!accountId) {
      accountId = await provisionExpressAccount();
      await recordAudit({
        actorId: user.id,
        actorRole: user.role,
        action: "seller.stripe_account.created",
        entityType: "SellerProfile",
        entityId: seller.id,
        after: { stripeAccountId: accountId },
      });
    }

    let onboardingUrl: string;
    try {
      onboardingUrl = await createOnboardingLink(accountId, origin);
    } catch (error) {
      if (error instanceof MissingStripeAccountError) {
        const recreatedId = await provisionExpressAccount();
        await recordAudit({
          actorId: user.id,
          actorRole: user.role,
          action: "seller.stripe_account.recreated",
          entityType: "SellerProfile",
          entityId: seller.id,
          before: { stripeAccountId: accountId },
          after: { stripeAccountId: recreatedId },
        });
        onboardingUrl = await createOnboardingLink(recreatedId, origin);
      } else {
        throw error;
      }
    }

    if (!onboardingUrl.startsWith("https://")) {
      return {
        status: "error",
        message: "Stripe did not return a valid onboarding link. Try again in a moment.",
      };
    }

    revalidatePath("/dashboard/settings");
    return { status: "redirect", url: onboardingUrl };
  } catch (error) {
    console.error("[seller] startConnectOnboardingAction failed:", error);
    const message =
      error instanceof ConnectError ? error.message : formatStripeConnectError(error, country);
    return { status: "error", message };
  }
}

export async function refreshConnectStatusAction(
  _previous: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user, seller } = access;

  if (!seller.stripeAccountId) {
    return errorState("No Stripe account is linked yet. Click Connect Stripe to get started.");
  }

  try {
    const status = await retrieveConnectStatus(seller.stripeAccountId);

    await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: {
        stripeChargesEnabled: status.chargesEnabled,
        stripePayoutsEnabled: status.payoutsEnabled,
        stripeDetailsSubmitted: status.detailsSubmitted,
        stripeOnboardedAt: status.detailsSubmitted ? (seller.stripeOnboardedAt ?? new Date()) : null,
      },
    });

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "seller.stripe_status.refreshed",
      entityType: "SellerProfile",
      entityId: seller.id,
      after: status,
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/earnings");
    revalidatePath("/dashboard");

    if (status.payoutsEnabled) {
      return successState("Stripe verified your payout account. Payouts are enabled.");
    }
    if (status.requirementsCurrentlyDue.length > 0) {
      return successState(
        `Synced with Stripe (${status.requirementsCurrentlyDue.length} detail${
          status.requirementsCurrentlyDue.length === 1 ? "" : "s"
        } still needed). Click Continue onboarding to finish.`,
      );
    }
    if (status.detailsSubmitted) {
      return successState(
        "Details submitted to Stripe. Verification is still in progress — check again shortly.",
      );
    }
    return successState("Synced with Stripe. Complete Stripe onboarding to enable payouts.");
  } catch (error) {
    if (error instanceof MissingStripeAccountError) {
      await prisma.sellerProfile.update({
        where: { id: seller.id },
        data: {
          stripeAccountId: null,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          stripeDetailsSubmitted: false,
          stripeOnboardedAt: null,
        },
      });
      await recordAudit({
        actorId: user.id,
        actorRole: user.role,
        action: "seller.stripe_account.cleared",
        entityType: "SellerProfile",
        entityId: seller.id,
        before: { stripeAccountId: seller.stripeAccountId },
      });
      revalidatePath("/dashboard/settings");
      revalidatePath("/dashboard/earnings");
      return errorState(
        "The saved Stripe account ID was not found in the active Stripe mode and was cleared. Click Connect Stripe to set up a fresh link.",
      );
    }

    if (error instanceof ConnectError) return errorState(error.message);
    return errorState(formatStripeConnectError(error));
  }
}

// ---------------------------------------------------------------- payouts

export async function requestPayoutAction(
  _previous: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user, seller } = access;

  try {
    const payout = await requestSellerPayout(seller.id);

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "seller.payout.requested",
      entityType: "Payout",
      entityId: payout.payoutId,
      after: { amountMinor: payout.amountMinor, currency: payout.currency },
    });

    revalidatePath("/dashboard/earnings");
    revalidatePath("/dashboard");
    return successState(
      `Requested ${formatMoney(payout.amountMinor, payout.currency)}. Platform staff review payouts before Stripe sends them.`,
    );
  } catch (error) {
    if (error instanceof ConnectError) return errorState(error.message);
    throw error;
  }
}

/**
 * Read-only helper used by the product form to show the seller what they keep
 * on a sale at the currently configured commission rate. It reads the same rule
 * engine that prices a real cart, so the numbers cannot drift apart.
 */
export async function previewCommissionAction(input: {
  categoryId: string;
  productId?: string;
}): Promise<{ ok: true; bps: number; label: string } | { ok: false; error: string }> {
  const access = await gate();
  if (!access.ok) return { ok: false, error: "Not authorised." };
  const { seller } = access;

  const rules = await prisma.commissionRule.findMany({
    where: { isActive: true },
    select: { scope: true, targetId: true, rateBps: true, isActive: true },
  });

  const rate = resolveCommissionRate({
    productId: input.productId ?? "00000000-0000-0000-0000-000000000000",
    categoryId: input.categoryId,
    sellerId: seller.id,
    sellerCommissionBps: seller.commissionBps,
    rules,
  });

  const keep = Math.max(0, Math.round((100 - bpsToPercent(rate.rateBps)) * 100) / 100);
  return {
    ok: true,
    bps: rate.rateBps,
    label: `Platform commission ${formatBps(rate.rateBps)} — you keep ${keep}% of each sale.`,
  };
}

// ---------------------------------------------------------------- coupons

export async function createSellerCouponAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user, seller } = access;

  const parsed = couponSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }
  const data = parsed.data;

  const existing = await prisma.coupon.findUnique({
    where: { code: data.code },
    select: { id: true },
  });
  if (existing) {
    return errorState("That promo code is already in use.", { code: "Already exists." });
  }

  const factor = minorUnitFactor(data.currency);
  const created = await prisma.coupon.create({
    data: {
      code: data.code,
      sellerId: seller.id,
      discountType: data.discountType,
      percentOff: data.discountType === "PERCENT" ? Math.round(data.discountValue) : null,
      amountOffMinor:
        data.discountType === "FIXED" ? Math.round(data.discountValue * factor) : null,
      currency: data.currency,
      minSubtotalMinor:
        data.minSubtotal !== undefined ? Math.round(data.minSubtotal * factor) : null,
      maxRedemptions: data.maxRedemptions ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: true,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "seller.coupon.created",
    entityType: "Coupon",
    entityId: created.id,
    after: { code: data.code, discountType: data.discountType, sellerId: seller.id },
  });

  revalidatePath("/dashboard/coupons");
  revalidatePath("/cart");
  return successState(`Promo code ${data.code} created for your store.`);
}

export async function toggleSellerCouponAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user, seller } = access;

  const couponId = String(formData.get("couponId") ?? "");
  const coupon = await prisma.coupon.findFirst({
    where: { id: couponId, sellerId: seller.id },
    select: { id: true, code: true, isActive: true },
  });
  if (!coupon) return;

  await prisma.coupon.update({
    where: { id: coupon.id },
    data: { isActive: !coupon.isActive },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: coupon.isActive ? "seller.coupon.paused" : "seller.coupon.activated",
    entityType: "Coupon",
    entityId: coupon.id,
    after: { code: coupon.code, isActive: !coupon.isActive },
  });

  revalidatePath("/dashboard/coupons");
  revalidatePath("/cart");
}

export async function deleteSellerCouponAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user, seller } = access;

  const couponId = String(formData.get("couponId") ?? "");
  const coupon = await prisma.coupon.findFirst({
    where: { id: couponId, sellerId: seller.id },
    select: { id: true, code: true },
  });
  if (!coupon) return;

  await prisma.coupon.delete({ where: { id: coupon.id } });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "seller.coupon.deleted",
    entityType: "Coupon",
    entityId: coupon.id,
    before: { code: coupon.code },
  });

  revalidatePath("/dashboard/coupons");
  revalidatePath("/cart");
}

// ---------------------------------------------------------------- bundles

export async function createSellerBundleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user, seller } = access;

  const parsed = bundleSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }
  const data = parsed.data;
  const uniqueProductIds = [...new Set(data.productIds)];
  if (uniqueProductIds.length < 2) {
    return errorState("Select at least 2 distinct published products.", {
      productIds: "Pick at least 2 distinct products.",
    });
  }

  const slugClash = await prisma.productBundle.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (slugClash) {
    return errorState("That bundle URL is already taken.", { slug: "Already in use." });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: uniqueProductIds }, sellerId: seller.id, status: "PUBLISHED" },
    select: { id: true, priceMinor: true, salePriceMinor: true, currency: true },
  });
  if (products.length !== uniqueProductIds.length) {
    return errorState("Every bundled item must be a published product in your store.", {
      productIds: "Only published products from your store can be bundled.",
    });
  }

  const mismatchedCurrency = products.find((p) => p.currency !== data.currency);
  if (mismatchedCurrency) {
    return errorState(`All bundled products must use ${data.currency}.`, {
      currency: `Included items use ${mismatchedCurrency.currency}.`,
    });
  }

  const factor = minorUnitFactor(data.currency);
  const bundlePriceMinor = Math.round(data.price * factor);
  const combinedMinor = products.reduce(
    (sum, p) => sum + (p.salePriceMinor ?? p.priceMinor),
    0,
  );
  if (bundlePriceMinor >= combinedMinor) {
    return errorState(
      `Bundle price must be lower than the combined individual value (${formatMoney(combinedMinor, data.currency)}).`,
      { price: "Must discount the combined items." },
    );
  }

  const created = await prisma.productBundle.create({
    data: {
      sellerId: seller.id,
      title: data.title,
      slug: data.slug,
      description: emptyToNull(data.description),
      bundlePriceMinor,
      currency: data.currency,
      isActive: true,
      items: {
        create: uniqueProductIds.map((productId, index) => ({
          productId,
          sortOrder: index,
        })),
      },
    },
    select: { id: true, slug: true },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "seller.bundle.created",
    entityType: "ProductBundle",
    entityId: created.id,
    after: { slug: data.slug, bundlePriceMinor, productCount: uniqueProductIds.length },
  });

  revalidatePath("/dashboard/bundles");
  revalidatePath(`/seller/${seller.slug}`);
  revalidatePath("/");
  revalidatePath("/browse");
  return successState(`Bundle “${data.title}” published.`);
}

export async function toggleSellerBundleAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user, seller } = access;

  const bundleId = String(formData.get("bundleId") ?? "");
  const bundle = await prisma.productBundle.findFirst({
    where: { id: bundleId, sellerId: seller.id },
    select: { id: true, slug: true, isActive: true },
  });
  if (!bundle) return;

  await prisma.productBundle.update({
    where: { id: bundle.id },
    data: { isActive: !bundle.isActive },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: bundle.isActive ? "seller.bundle.paused" : "seller.bundle.activated",
    entityType: "ProductBundle",
    entityId: bundle.id,
    after: { isActive: !bundle.isActive },
  });

  revalidatePath("/dashboard/bundles");
  revalidatePath(`/bundle/${bundle.slug}`);
  revalidatePath(`/seller/${seller.slug}`);
  revalidatePath("/");
  revalidatePath("/cart");
}

export async function deleteSellerBundleAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user, seller } = access;

  const bundleId = String(formData.get("bundleId") ?? "");
  const bundle = await prisma.productBundle.findFirst({
    where: { id: bundleId, sellerId: seller.id },
    select: { id: true, slug: true, title: true },
  });
  if (!bundle) return;

  await prisma.productBundle.delete({ where: { id: bundle.id } });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "seller.bundle.deleted",
    entityType: "ProductBundle",
    entityId: bundle.id,
    before: { title: bundle.title, slug: bundle.slug },
  });

  revalidatePath("/dashboard/bundles");
  revalidatePath(`/bundle/${bundle.slug}`);
  revalidatePath(`/seller/${seller.slug}`);
  revalidatePath("/");
  revalidatePath("/cart");
}
