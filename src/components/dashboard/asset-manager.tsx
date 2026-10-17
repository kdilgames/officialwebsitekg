"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderUp, Loader2, Star, Trash2, Upload } from "lucide-react";
import { zip } from "fflate";

import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import type { UploadTicket } from "@/lib/storage";
import {
  deleteProductFileAction,
  deleteProductImageAction,
  finalizeProductFileAction,
  finalizeProductImageAction,
  requestProductFileUpload,
  requestProductImageUpload,
  setThumbnailAction,
} from "@/lib/seller/actions";

export type AssetFile = {
  id: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  scanStatus: string;
  scanNote: string | null;
  isActive: boolean;
  createdAt: string;
  downloads: number;
  versionId: string | null;
};

export type AssetImage = {
  id: string;
  url: string;
  alt: string | null;
};

export type AssetVersion = { id: string; version: string; isLatest: boolean };

/** Suggested screenshot size; the storefront crops to this 2:1 frame. */
const RECOMMENDED_IMAGE = { width: 1024, height: 512 };

function formatBytes(bytes: number): string {
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

/** Makes a file name safe to use as the archive's name, matching the server rule. */
function safeBaseName(raw: string): string {
  const cleaned = raw
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 60);
  return cleaned.length > 0 ? cleaned : "product-files";
}

/** Reads an image's pixel dimensions from the browser before uploading. */
async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    } catch {
      // Fall through to the <img> path below.
    }
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

export function ProductFilesPanel({
  productId,
  productName,
  files,
  versions,
  maxBytes,
}: {
  productId: string;
  productName: string;
  files: AssetFile[];
  versions: AssetVersion[];
  maxBytes: number;
}) {
  const router = useRouter();
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string>(versions[0]?.id ?? "");

  // React has no typed prop for the (widely supported) directory picker.
  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  async function uploadToTicket(file: File, label: string) {
    const ticket: UploadTicket = await requestProductFileUpload({
      productId,
      fileName: file.name,
      sizeBytes: file.size,
    });
    if (!ticket.ok) {
      setError(ticket.error);
      return;
    }

    setStage(`Uploading ${label}…`);

    const supabase = createSupabaseBrowserClient();
    const { error: uploadError } = await supabase.storage
      .from(ticket.bucket)
      .uploadToSignedUrl(ticket.path, ticket.token, file, {
        contentType: file.type || undefined,
      });

    if (uploadError) {
      setError(`The upload failed: ${uploadError.message}`);
      return;
    }

    const result = await finalizeProductFileAction({
      productId,
      path: ticket.path,
      fileName: file.name,
      versionId: versionId || null,
    });

    if (result.status === "error") {
      setError(result.message ?? "The file could not be registered.");
      return;
    }

    setMessage(`${label} attached.`);
    router.refresh();
  }

  /**
   * Packs a folder (or a multi-file selection) into a single archive.
   *
   * Buyers should receive one complete download rather than a pile of loose
   * files, so the archive is built in the browser and uploaded through the same
   * signed-ticket flow as a single file. Nothing is sent to the application
   * server: the bytes go straight to private storage.
   */
  async function uploadArchive(picked: File[]) {
    const totalBytes = picked.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > maxBytes) {
      setError(
        `Those files add up to ${formatBytes(totalBytes)}. The upload limit is ${Math.round(maxBytes / (1024 * 1024))} MB.`,
      );
      return;
    }

    setStage(`Packing ${picked.length} files…`);

    const entries: Record<string, Uint8Array> = {};
    for (const file of picked) {
      const relative = file.webkitRelativePath || file.name;
      const key = entries[relative] ? `${Object.keys(entries).length}-${relative}` : relative;
      entries[key] = new Uint8Array(await file.arrayBuffer());
    }

    const archive = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
      zip(entries, { level: 6 }, (cause, data) => {
        if (cause) reject(cause);
        else resolve(data);
      });
    });

    if (archive.byteLength > maxBytes) {
      setError(
        `The archive is ${formatBytes(archive.byteLength)}, over the ${Math.round(maxBytes / (1024 * 1024))} MB limit. Split it into smaller parts.`,
      );
      return;
    }

    const root = picked.find((file) => file.webkitRelativePath)?.webkitRelativePath.split("/")[0];
    const name = `${safeBaseName(root ?? productName)}.zip`;
    const archiveFile = new File([archive], name, { type: "application/zip" });

    await uploadToTicket(archiveFile, `${picked.length} files as ${name}`);
  }

  async function handleSelection(list: FileList | null) {
    const picked = list ? Array.from(list) : [];
    if (filesInputRef.current) filesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (picked.length === 0) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    setStage(null);

    try {
      // A single, directly picked file is uploaded as-is.
      const [first] = picked;
      if (picked.length === 1 && first && !first.webkitRelativePath) {
        await uploadToTicket(first, first.name);
        return;
      }
      await uploadArchive(picked);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The upload failed.");
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <div className="space-y-3.5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <Alert tone="warning" title="Files are not virus-scanned">
        No malware scanner is available on this deployment. Every uploaded file is published with a
        “not scanned” status and downloads are served only to buyers with a paid order.
      </Alert>

      <div className="grid gap-3.5 sm:grid-cols-[1fr_200px]">
        <Field
          label="Attach files or a folder"
          htmlFor="product-file"
          hint="Pick one file, several files at once, or a whole folder — anything with more than one file is packed into a single .zip automatically. Executables are rejected."
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={filesInputRef}
              id="product-file"
              type="file"
              multiple
              disabled={busy}
              className="input file:mr-2 file:rounded-[6px] file:border-0 file:bg-raised file:px-2.5 file:py-1 file:text-[12px] file:text-ink"
              onChange={(event) => void handleSelection(event.target.files)}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              disabled={busy}
              className="hidden"
              onChange={(event) => void handleSelection(event.target.files)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderUp className="size-3.5" aria-hidden />
              Add a folder
            </Button>
          </div>
        </Field>
        <Field label="Release" htmlFor="versionId" hint="Optional, links the upload to a version.">
          <Select
            id="versionId"
            value={versionId}
            onChange={(event) => setVersionId(event.target.value)}
            disabled={versions.length === 0}
          >
            <option value="">Unversioned</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.version}
                {version.isLatest ? " (latest)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {busy ? (
        <p className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {stage ?? "Preparing the upload…"}
        </p>
      ) : null}

      {files.length === 0 ? (
        <p className="muted text-[12.5px]">
          No files yet. A product cannot be submitted for review without at least one active file.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Size</th>
                <th>Scan</th>
                <th className="text-right">Downloads</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className={file.isActive ? undefined : "opacity-60"}>
                  <td>
                    <span className="block max-w-[280px] truncate font-mono text-[12px]">
                      {file.fileName}
                    </span>
                    <span className="subtle text-[11.5px]">
                      {file.mimeType} · added {file.createdAt.slice(0, 10)}
                      {file.isActive ? "" : " · inactive"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap tabular-nums">{formatBytes(file.sizeBytes)}</td>
                  <td>
                    <StatusBadge status={file.scanStatus} />
                  </td>
                  <td className="text-right tabular-nums">{file.downloads}</td>
                  <td className="text-right">
                    <form action={deleteProductFileAction}>
                      <input type="hidden" name="fileId" value={file.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        title={
                          file.downloads > 0
                            ? "Buyers already downloaded this file, so it is deactivated rather than deleted."
                            : "Delete this file"
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        {file.downloads > 0 ? "Deactivate" : "Delete"}
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ProductImagesPanel({
  productId,
  images,
  maxImages,
}: {
  productId: string;
  images: AssetImage[];
  maxImages: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const size = await readImageSize(file);
      if (
        size &&
        (size.width !== RECOMMENDED_IMAGE.width || size.height !== RECOMMENDED_IMAGE.height)
      ) {
        setNotice(
          `That image is ${size.width}×${size.height}. The recommended size is ${RECOMMENDED_IMAGE.width}×${RECOMMENDED_IMAGE.height} (2:1) — the listing crops to that frame, so anything else loses its edges.`,
        );
      }

      const ticket = await requestProductImageUpload({
        productId,
        fileName: file.name,
        sizeBytes: file.size,
      });
      if (!ticket.ok) {
        setError(ticket.error);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(ticket.bucket)
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type || undefined });

      if (uploadError) {
        setError(`The upload failed: ${uploadError.message}`);
        return;
      }

      const result = await finalizeProductImageAction({ productId, path: ticket.path });
      if (result.status === "error") {
        setError(result.message ?? "The image could not be registered.");
        return;
      }

      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3.5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="warning">{notice}</Alert> : null}

      <Field
        label="Add a screenshot"
        htmlFor="product-image"
        hint={`PNG, JPG, WebP, GIF or AVIF at ${RECOMMENDED_IMAGE.width}×${RECOMMENDED_IMAGE.height} (2:1). Up to ${maxImages} images per listing — buyers scroll through them on the product page.`}
      >
        <input
          ref={inputRef}
          id="product-image"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          disabled={busy || images.length >= maxImages}
          className="input file:mr-2 file:rounded-[6px] file:border-0 file:bg-raised file:px-2.5 file:py-1 file:text-[12px] file:text-ink"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </Field>

      {busy ? (
        <p className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Uploading image…
        </p>
      ) : null}

      {images.length === 0 ? (
        <p className="muted text-[12.5px]">
          No images yet. The first image you upload becomes the listing thumbnail.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {images.map((image) => (
            <li key={image.id} className="surface-elevated overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="aspect-[2/1] w-full object-cover" loading="lazy" />
              <div className="flex items-center justify-between gap-2 p-2">
                <form action={setThumbnailAction}>
                  <input type="hidden" name="imageId" value={image.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    <Star className="size-3.5" aria-hidden />
                    Use as thumbnail
                  </Button>
                </form>
                <form action={deleteProductImageAction}>
                  <input type="hidden" name="imageId" value={image.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    <Trash2 className="size-3.5" aria-hidden />
                    Remove
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="subtle flex items-center gap-1.5 text-[11.5px]">
        <Upload className="size-3.5" aria-hidden />
        Images are stored in a public bucket; product files are private and served through expiring
        links only.
      </p>
    </div>
  );
}
