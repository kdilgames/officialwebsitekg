import { createSupabaseServerClient } from "@/lib/auth/server";
import { env } from "@/lib/env";

export type StorageBucket = "product-files" | "product-images" | "avatars";

export const PRODUCT_FILES_BUCKET = env.uploads.productFileBucket;
export const PRODUCT_IMAGES_BUCKET = env.uploads.productImageBucket;
export const AVATARS_BUCKET = env.uploads.avatarBucket;

/**
 * Result of asking the server to authorise an upload. The path is generated on
 * the server; the browser only ever receives the ticket.
 */
export type UploadTicket =
  | { ok: true; path: string; token: string; bucket: StorageBucket }
  | { ok: false; error: string };

/** Storage object names are namespaced by seller so RLS can authorise by prefix. */
export function buildProductFilePath(params: {
  sellerId: string;
  productId: string;
  fileId: string;
  fileName: string;
}): string {
  return [
    params.sellerId,
    params.productId,
    params.fileId,
    sanitizeFileName(params.fileName),
  ].join("/");
}

export function buildProductImagePath(params: {
  sellerId: string;
  productId: string;
  fileName: string;
}): string {
  const stamp = Date.now().toString(36);
  return [params.sellerId, params.productId, `${stamp}-${sanitizeFileName(params.fileName)}`].join(
    "/",
  );
}

/**
 * Strips directory separators and traversal sequences. Storage keys are also
 * validated by the bucket policies, but never trust a client-supplied name.
 */
export function sanitizeFileName(raw: string): string {
  const cleaned = raw
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned && cleaned.length > 0 ? cleaned : "file";
}

/**
 * Avatars and store logos share one public bucket. The first segment is the
 * `User.id` (personal avatar) or `SellerProfile.id` (store logo) that owns the
 * object, so the bucket policy can authorise by prefix.
 */
export function buildAvatarPath(params: { ownerId: string; fileName: string }): string {
  const stamp = Date.now().toString(36);
  return [params.ownerId, `${stamp}-${sanitizeFileName(params.fileName)}`].join("/");
}

/** Public URL for objects in the public `product-images` bucket. */
export function publicImageUrl(path: string): string {
  return publicObjectUrl(PRODUCT_IMAGES_BUCKET, path);
}

/** Public URL for objects in the public `avatars` bucket. */
export function publicAvatarUrl(path: string): string {
  return publicObjectUrl(AVATARS_BUCKET, path);
}

function publicObjectUrl(bucket: string, path: string): string {
  const base = env.supabase.url ?? "";
  return `${base}/storage/v1/object/public/${bucket}/${encodePath(path)}`;
}

/**
 * Recovers the object name from a public URL, or null when the URL points at a
 * different bucket. Used to clean up a replaced object.
 */
export function storagePathFromPublicUrl(bucket: string, url: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length);
  return path.length > 0 ? decodeURIComponent(path) : null;
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Short-lived signed upload URL. The caller must already have been authorised
 * (seller owning the product); Supabase re-checks the storage policy as well.
 */
export async function createSignedUploadUrl(bucket: StorageBucket, path: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error) throw new Error(`Unable to create upload URL: ${error.message}`);
  return data;
}

/**
 * Short-lived signed download URL for a private object. Only called after the
 * server has verified the purchase entitlement in the database; Supabase
 * re-checks the storage policy on the object itself.
 */
export async function createSignedDownloadUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 300,
  fileName?: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds, fileName ? { download: fileName } : undefined);
  if (error) throw new Error(`Unable to create download URL: ${error.message}`);
  return data.signedUrl;
}

export async function removeStorageObjects(bucket: StorageBucket, paths: string[]) {
  if (paths.length === 0) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw new Error(`Unable to remove objects: ${error.message}`);
}

/**
 * Reads an object's real size back from storage.
 *
 * Used to verify that a browser-side upload actually landed in the bucket, and
 * to record the size the storage service reports rather than a value supplied
 * by the client. Returns null when the object is not present.
 */
export async function getUploadedObjectSize(
  bucket: StorageBucket,
  path: string,
): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  const segments = path.split("/");
  const name = segments.pop() ?? "";
  const folder = segments.join("/");

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, { search: name, limit: 100 });
  if (error) throw new Error(`Unable to verify the uploaded object: ${error.message}`);

  const match = data?.find((entry) => entry.name === name);
  if (!match) return null;

  const size = (match.metadata as { size?: number } | null)?.size;
  return typeof size === "number" ? size : 0;
}

/** Removes an object, tolerating a missing object (the row is cleaned up anyway). */
export async function removeStorageObject(bucket: StorageBucket, path: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Unable to remove the object: ${error.message}`);
}
