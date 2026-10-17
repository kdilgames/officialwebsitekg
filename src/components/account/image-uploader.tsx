"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import type { ActionState } from "@/lib/action-state";

const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

type UploadTicketResult =
  | { ok: true; path: string; token: string; bucket: string }
  | { ok: false; error: string };

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

/**
 * Uploads a single public image (personal avatar or store logo).
 *
 * The browser talks to Supabase Storage directly with a short-lived ticket that
 * the server issues; the object is only recorded once the server has verified
 * where it landed. Dimensions are not enforced — the preview is cropped — but
 * square images look best.
 */
export function ImageUploader({
  title,
  hint,
  recommended,
  currentUrl,
  fallback,
  maxBytes,
  rounded = "full",
  size = "size-16",
  requestUpload,
  finalize,
}: {
  title: string;
  hint: string;
  recommended: string;
  currentUrl: string | null;
  fallback: string;
  maxBytes: number;
  rounded?: "full" | "rounded";
  size?: string;
  requestUpload: (input: { fileName: string; sizeBytes: number }) => Promise<UploadTicketResult>;
  finalize: (input: { path: string }) => Promise<ActionState>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (!ALLOWED_EXTENSIONS.has(extensionOf(file.name))) {
        setError("Use a PNG, JPG, WebP, GIF or AVIF image.");
        return;
      }
      if (file.size > maxBytes) {
        setError(`Images must be smaller than ${Math.round(maxBytes / (1024 * 1024))} MB.`);
        return;
      }

      const ticket = await requestUpload({ fileName: file.name, sizeBytes: file.size });
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

      const result = await finalize({ path: ticket.path });
      if (result.status === "error") {
        setError(result.message ?? "The image could not be saved.");
        return;
      }

      setMessage(result.message ?? "Image updated.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="flex items-center gap-3.5">
        <div
          className={`${size} shrink-0 overflow-hidden border border-line bg-elevated ${
            rounded === "full" ? "rounded-full" : "rounded-[10px]"
          }`}
        >
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
            <img src={currentUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-[15px] font-semibold text-ink-subtle">
              {fallback}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-1.5">
          <p className="text-[12.5px] font-medium text-ink">{title}</p>
          <p className="muted text-[11.5px] leading-relaxed">{hint}</p>
          <p className="subtle text-[11px]">{recommended}</p>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-3.5" aria-hidden />
            )}
            {busy ? "Uploading…" : currentUrl ? "Change image" : "Upload image"}
          </Button>
        </div>
      </div>
    </div>
  );
}
