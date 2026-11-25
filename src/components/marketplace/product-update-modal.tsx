"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { zip } from "fflate";
import {
  CheckCircle2,
  FileArchive,
  FolderUp,
  Loader2,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { BBCodeEditor } from "@/components/ui/bbcode-editor";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import {
  finalizeProductFileAction,
  publishProductUpdateFromPageAction,
  requestProductFileUpload,
} from "@/lib/seller/actions";
import type { UploadTicket } from "@/lib/storage";
import {
  formatBytes,
  isAllowedProductFile,
  safeArchiveBaseName,
} from "@/lib/upload-rules";
import { cn } from "@/lib/utils/cn";

function suggestNextVersion(current: string): string {
  const trimmed = current.trim();
  const match = /^(.*?)(\d+)$/.exec(trimmed);
  if (match && match[2]) {
    const prefix = match[1] ?? "";
    const num = Number.parseInt(match[2], 10);
    if (Number.isFinite(num)) {
      return `${prefix}${num + 1}`;
    }
  }
  return "";
}

export function ProductUpdateModalTrigger({
  productId,
  productSlug,
  productTitle,
  currentVersion,
  activeFileCount,
  isSupabaseConfigured = true,
  maxFileBytes = 512 * 1024 * 1024,
}: {
  productId: string;
  productSlug: string;
  productTitle: string;
  currentVersion: string;
  activeFileCount: number;
  isSupabaseConfigured?: boolean;
  maxFileBytes?: number;
}) {
  const router = useRouter();
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(() => suggestNextVersion(currentVersion));
  const [postUpdate, setPostUpdate] = useState(true);
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [replacePreviousFiles, setReplacePreviousFiles] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdVersion, setCreatedVersion] = useState<{
    versionId: string;
    version: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      folderInputRef.current?.setAttribute("webkitdirectory", "");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, submitting]);

  function openModal() {
    setVersion(suggestNextVersion(currentVersion));
    setPostUpdate(true);
    setUpdateTitle("");
    setUpdateMessage("");
    setQueuedFiles([]);
    setReplacePreviousFiles(true);
    setErrorMessage(null);
    setFieldErrors({});
    setStage(null);
    setCreatedVersion(null);
    setOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setOpen(false);
  }

  function queueDeliverableFiles(list: FileList | File[] | null, replaceExisting = false) {
    const picked = list ? Array.from(list) : [];
    if (filesInputRef.current) filesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (picked.length === 0) return;

    setErrorMessage(null);

    const validNonEmpty = picked.filter((file) => file.size > 0);
    if (validNonEmpty.length === 0) {
      setErrorMessage(
        "Selected files are empty. If you dragged a folder, use the “Upload folder” button instead.",
      );
      return;
    }

    if (validNonEmpty.length > 2500) {
      setErrorMessage(
        `Too many individual files (${validNonEmpty.length}). Zip the folder on your PC first and upload the .zip file.`,
      );
      return;
    }

    const nextList = replaceExisting ? validNonEmpty : [...queuedFiles, ...validNonEmpty];

    if (nextList.length === 1) {
      const single = nextList[0];
      if (single && !single.webkitRelativePath && !isAllowedProductFile(single.name)) {
        setErrorMessage(
          `“${single.name}” uses an unsupported file extension. Upload an archive (.zip), plugin, script, asset, or pick multiple files/a folder to pack into .zip.`,
        );
        return;
      }
    }

    const totalBytes = nextList.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > maxFileBytes) {
      setErrorMessage(
        `Selected files add up to ${formatBytes(totalBytes)}, exceeding the ${Math.round(maxFileBytes / (1024 * 1024))} MB limit.`,
      );
      return;
    }

    setQueuedFiles(nextList);
  }

  async function packFilesIfNeeded(files: File[], versionLabel: string): Promise<File> {
    const [single] = files;
    if (files.length === 1 && single && !single.webkitRelativePath) {
      return single;
    }

    setStage(`Packing ${files.length} files into a .zip archive…`);
    const entries: Record<string, Uint8Array> = {};
    for (const file of files) {
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

    if (archive.byteLength > maxFileBytes) {
      throw new Error(
        `Packed archive is ${formatBytes(archive.byteLength)}, over the ${Math.round(maxFileBytes / (1024 * 1024))} MB upload limit.`,
      );
    }

    const root = files.find((file) => file.webkitRelativePath)?.webkitRelativePath.split("/")[0];
    const baseName = root || `${productSlug}-v${versionLabel}` || "product-update";
    return new File([archive], `${safeArchiveBaseName(baseName)}.zip`, { type: "application/zip" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmedVersion = version.trim();
    setSubmitting(true);
    setErrorMessage(null);
    setFieldErrors({});

    try {
      if (queuedFiles.length > 0 && !isSupabaseConfigured) {
        setErrorMessage(
          "File storage is not configured in this environment. Clear the selected files to publish changelog notes only.",
        );
        return;
      }

      let versionId = createdVersion?.version === trimmedVersion ? createdVersion.versionId : null;

      if (!versionId) {
        setStage(`Publishing version ${trimmedVersion}…`);
        const updateRes = await publishProductUpdateFromPageAction({
          productId,
          version: trimmedVersion,
          postUpdate,
          updateTitle,
          updateMessage,
        });

        if (!updateRes.ok) {
          setErrorMessage(updateRes.state.message ?? "Could not publish update.");
          setFieldErrors(updateRes.state.fieldErrors ?? {});
          return;
        }

        versionId = updateRes.versionId;
        setCreatedVersion({ versionId, version: trimmedVersion });
      }

      if (queuedFiles.length > 0) {
        const deliverable = await packFilesIfNeeded(queuedFiles, trimmedVersion);

        setStage(`Authorising upload for ${deliverable.name}…`);
        const ticket: UploadTicket = await requestProductFileUpload({
          productId,
          fileName: deliverable.name,
          sizeBytes: deliverable.size,
        });
        if (!ticket.ok) {
          throw new Error(ticket.error);
        }

        const supabase = createSupabaseBrowserClient();
        setStage(`Uploading ${deliverable.name} (${formatBytes(deliverable.size)})…`);
        const { error: uploadError } = await supabase.storage
          .from(ticket.bucket)
          .uploadToSignedUrl(ticket.path, ticket.token, deliverable, {
            contentType: deliverable.type || undefined,
          });
        if (uploadError) {
          throw new Error(`File upload failed: ${uploadError.message}`);
        }

        setStage("Linking uploaded file to release…");
        const finalRes = await finalizeProductFileAction({
          productId,
          path: ticket.path,
          fileName: deliverable.name,
          versionId,
          note: `v${trimmedVersion}`,
          replacePreviousFiles: activeFileCount > 0 ? replacePreviousFiles : false,
        });
        if (finalRes.status === "error") {
          throw new Error(finalRes.message ?? "Could not attach the uploaded file.");
        }
      }

      setOpen(false);
      router.push(`/product/${productSlug}?tab=updates`, { scroll: false });
      router.refresh();
    } catch (cause) {
      setErrorMessage(
        cause instanceof Error ? cause.message : "Could not complete update. Try again.",
      );
    } finally {
      setSubmitting(false);
      setStage(null);
    }
  }

  const totalQueuedBytes = queuedFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <>
      <Button type="button" variant="primary" size="sm" className="flex-1" onClick={openModal}>
        <Upload className="size-3.5" aria-hidden />
        Update
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3 backdrop-blur-[2px] sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-product-modal-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="surface-card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-line bg-elevated/70 px-5 py-3.5">
              <div className="min-w-0">
                <h2
                  id="update-product-modal-title"
                  className="truncate text-[16px] font-semibold tracking-tight text-ink"
                >
                  Update product
                </h2>
                <p className="subtle truncate text-[12px]">{productTitle}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Close update modal"
                className="flex size-8 items-center justify-center rounded-[8px] text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-50"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="flex-1 space-y-5 overflow-y-auto p-5"
            >
              {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

              <div className="space-y-4">
                <p className="border-b border-line pb-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">
                  Release a new version
                </p>

                <Field
                  label="New version number"
                  htmlFor="modal-new-version"
                  error={fieldErrors.version}
                  hint={`Current live version is v${currentVersion}.`}
                >
                  <Input
                    id="modal-new-version"
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                    placeholder={`e.g. ${suggestNextVersion(currentVersion) || "1.1.0"}`}
                    required
                    maxLength={32}
                    disabled={submitting || Boolean(createdVersion)}
                  />
                </Field>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="label mb-0">New content (from PC)</span>
                    <span className="subtle text-[11.5px]">
                      Optional · up to {Math.round(maxFileBytes / (1024 * 1024))} MB
                    </span>
                  </div>

                  {!isSupabaseConfigured ? (
                    <Alert tone="warning">
                      Direct file uploads are disabled because file storage is not configured in this
                      environment. You can still post a changelog update below.
                    </Alert>
                  ) : null}

                  <input
                    ref={filesInputRef}
                    type="file"
                    multiple
                    disabled={submitting || !isSupabaseConfigured}
                    className="hidden"
                    onChange={(event) => queueDeliverableFiles(event.target.files, false)}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    disabled={submitting || !isSupabaseConfigured}
                    className="hidden"
                    onChange={(event) => queueDeliverableFiles(event.target.files, true)}
                  />

                  <div
                    onDragOver={(event) => {
                      if (!isSupabaseConfigured || submitting) return;
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                      if (!isSupabaseConfigured || submitting) return;
                      queueDeliverableFiles(event.dataTransfer.files, false);
                    }}
                    className={cn(
                      "rounded-[10px] border border-dashed p-4 transition-colors",
                      dragActive
                        ? "border-accent bg-accent/5"
                        : "border-line-strong bg-elevated/40",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-[13px] font-medium text-ink">
                          Attach updated files for buyers
                        </p>
                        <p className="subtle text-[12px]">
                          Drop a .zip, .rbxl, plugin, or pick multiple files/a folder (auto-zipped).
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={submitting || !isSupabaseConfigured}
                          onClick={() => filesInputRef.current?.click()}
                        >
                          <Upload className="size-3.5" aria-hidden />
                          Choose files from PC
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={submitting || !isSupabaseConfigured}
                          onClick={() => folderInputRef.current?.click()}
                        >
                          <FolderUp className="size-3.5" aria-hidden />
                          Upload folder
                        </Button>
                      </div>
                    </div>

                    {queuedFiles.length > 0 ? (
                      <div className="mt-3 space-y-2 border-t border-line pt-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line bg-surface px-3 py-2 text-[12.5px]">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileArchive className="size-4 shrink-0 text-accent" aria-hidden />
                            <span className="truncate font-medium text-ink">
                              {queuedFiles.length === 1 && !queuedFiles[0]?.webkitRelativePath
                                ? queuedFiles[0]?.name
                                : `${queuedFiles.length} files (will pack into .zip)`}
                            </span>
                            <span className="subtle shrink-0 text-[11.5px] tabular-nums">
                              {formatBytes(totalQueuedBytes)}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setQueuedFiles([])}
                            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-muted hover:text-critical disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                            Remove
                          </button>
                        </div>

                        {activeFileCount > 0 ? (
                          <label className="flex items-start gap-2 text-[12px] text-ink-muted">
                            <input
                              type="checkbox"
                              checked={replacePreviousFiles}
                              disabled={submitting}
                              onChange={(event) => setReplacePreviousFiles(event.target.checked)}
                              className="mt-0.5 size-4 rounded border-line-strong text-accent focus:ring-accent"
                            />
                            <span>
                              Replace previous active download file(s) with this version (existing
                              buyers automatically receive the new download)
                            </span>
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="border-b border-line pb-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">
                  Post an update
                </p>

                <label className="flex items-center gap-2.5 text-[13px] font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={postUpdate}
                    disabled={submitting || Boolean(createdVersion)}
                    onChange={(event) => setPostUpdate(event.target.checked)}
                    className="size-4 rounded border-line-strong text-accent focus:ring-accent"
                  />
                  Post an update announcement to the Updates tab &amp; notify buyers
                </label>

                {postUpdate ? (
                  <div className="space-y-3.5">
                    <Field
                      label="Update title"
                      htmlFor="modal-update-title"
                      error={fieldErrors.updateTitle}
                    >
                      <Input
                        id="modal-update-title"
                        value={updateTitle}
                        onChange={(event) => setUpdateTitle(event.target.value)}
                        placeholder="e.g. ACS V4.0 Enterprise Edition is here!"
                        maxLength={140}
                        disabled={submitting || Boolean(createdVersion)}
                      />
                    </Field>

                    <Field
                      label="Update message"
                      htmlFor="modal-update-message"
                      error={fieldErrors.updateMessage}
                    >
                      <BBCodeEditor
                        id="modal-update-message"
                        name="updateMessage"
                        value={updateMessage}
                        onChange={setUpdateMessage}
                        rows={6}
                        maxLength={8000}
                        required={false}
                        placeholder="Highlight new features, bug fixes, breaking changes, or installation notes…"
                      />
                    </Field>
                  </div>
                ) : null}
              </div>

              {submitting && stage ? (
                <p className="flex items-center gap-2 text-[12.5px] font-medium text-accent">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {stage}
                </p>
              ) : null}

              {createdVersion && !submitting ? (
                <Alert tone="info">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-positive" aria-hidden />
                    Version v{createdVersion.version} has already been published. Click Save again
                    to retry uploading your attached file.
                  </span>
                </Alert>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line pt-4">
                <Button type="button" variant="secondary" size="sm" onClick={closeModal} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-3.5" aria-hidden />
                  )}
                  {submitting ? (stage ?? "Saving…") : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
