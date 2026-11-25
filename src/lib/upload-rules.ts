/**
 * Shared client- and server-safe upload constraints for product deliverables
 * and storefront images.
 *
 * Kept free of Node/Next/Prisma imports so both browser upload components and
 * server actions share identical validation rules.
 */

export const ALLOWED_FILE_EXTENSIONS = new Set([
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "tgz",
  "jar",
  "unitypackage",
  "rbxm",
  "rbxmx",
  "rbxl",
  "rbxlx",
  "lua",
  "luau",
  "js",
  "json",
  "txt",
  "md",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "blend",
  "fbx",
  "obj",
  "gltf",
  "glb",
  "uasset",
  "pak",
  "yml",
  "yaml",
  "toml",
  "cfg",
  "ini",
  "csv",
  "xlsx",
  "docx",
  "pptx",
  "mp3",
  "wav",
  "ogg",
  "mp4",
  "webm",
  "ttf",
  "otf",
  "woff",
  "woff2",
  "sk",
  "sb3",
  "mcpack",
  "mcaddon",
  "mcworld",
  "schem",
  "mcstructure",
  "dat",
  "db",
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

export function sanitizeUploadFileName(raw: string): string {
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

export function extensionOfFileName(fileName: string): string {
  const parts = sanitizeUploadFileName(fileName).split(".");
  return parts.length > 1 ? (parts.pop() ?? "").toLowerCase() : "";
}

export function isAllowedProductFile(fileName: string): boolean {
  const ext = extensionOfFileName(fileName);
  return ext.length > 0 && ALLOWED_FILE_EXTENSIONS.has(ext);
}

export function isAllowedImageFile(fileName: string): boolean {
  const ext = extensionOfFileName(fileName);
  return ext.length > 0 && ALLOWED_IMAGE_EXTENSIONS.has(ext);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[index]}`;
}

export function safeArchiveBaseName(raw: string): string {
  const cleaned = raw
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 60);
  return cleaned.length > 0 ? cleaned : "product-files";
}
