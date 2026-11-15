"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zip } from "fflate";
import { CheckCircle2, FileArchive, FolderUp, ImagePlus, Loader2, Trash2, Upload, X } from "lucide-react";

import { getCompatibilityTagsForCategory } from "@/components/marketplace/category-filters";
import { Alert } from "@/components/ui/alert";
import { BBCodeEditor } from "@/components/ui/bbcode-editor";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { idleState, type ActionState } from "@/lib/action-state";
import {
  finalizeProductFileAction,
  finalizeProductImageAction,
  requestProductFileUpload,
  requestProductImageUpload,
  saveProductDraftForUploadAction,
  submitCreatedProductForReviewAction,
} from "@/lib/seller/actions";
import type { UploadTicket } from "@/lib/storage";
import {
  formatBytes,
  isAllowedImageFile,
  isAllowedProductFile,
  safeArchiveBaseName,
} from "@/lib/upload-rules";
import { cn } from "@/lib/utils/cn";
import { slugify } from "@/lib/utils/slug";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

function Message({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>;
}

const LICENSE_TYPES = [
  { value: "PERSONAL", label: "Personal" },
  { value: "STANDARD", label: "Standard" },
  { value: "EXTENDED", label: "Extended" },
  { value: "CUSTOM", label: "Custom" },
];

const CURRENCIES = ["EUR", "USD", "GBP"];
const RECOMMENDED_IMAGE = { width: 1024, height: 512 };

type QueuedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

async function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    } catch {
      // Fallback below.
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

export type ProductFormDefaults = {
  title: string;
  slug: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  price: string;
  salePrice: string;
  currency: string;
  licenseType: string;
  licenseText: string;
  demoUrl: string;
  videoUrl: string;
  version: string;
  tags: string;
  compatibility: string;
  requirements: string;
};

export function ProductForm({
  action,
  categories,
  defaults,
  submitLabel = "Save product",
  productId,
  enableInitialUploads = false,
  isSupabaseConfigured = true,
  maxFileBytes = 512 * 1024 * 1024,
  maxImageBytes = 8 * 1024 * 1024,
  maxImages = 8,
}: {
  action: FormAction;
  categories: Array<{ id: string; name: string; slug: string; parentId?: string | null }>;
  defaults: ProductFormDefaults;
  submitLabel?: string;
  productId?: string;
  enableInitialUploads?: boolean;
  isSupabaseConfigured?: boolean;
  maxFileBytes?: number;
  maxImageBytes?: number;
  maxImages?: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const [serverState, formAction, serverPending] = useActionState(action, idleState);
  const [customState, setCustomState] = useState<ActionState | null>(null);
  const state = customState ?? serverState;

  const { topCategories, childrenByParentId, categoryById } = useMemo(() => {
    const byId = new Map(categories.map((entry) => [entry.id, entry]));
    const roots = categories.filter((entry) => !entry.parentId || !byId.has(entry.parentId));
    const grouped = new Map<string, Array<(typeof categories)[number]>>();
    for (const entry of categories) {
      if (entry.parentId && byId.has(entry.parentId)) {
        const list = grouped.get(entry.parentId) ?? [];
        list.push(entry);
        grouped.set(entry.parentId, list);
      }
    }
    return { topCategories: roots, childrenByParentId: grouped, categoryById: byId };
  }, [categories]);

  const initialSelection = useMemo(() => {
    const initial = categoryById.get(defaults.categoryId);
    if (initial?.parentId && categoryById.has(initial.parentId)) {
      return { parentId: initial.parentId, childId: initial.id };
    }
    return { parentId: defaults.categoryId, childId: "" };
  }, [categoryById, defaults.categoryId]);

  const [titleValue, setTitleValue] = useState(defaults.title);
  const [slugValue, setSlugValue] = useState(defaults.slug);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(defaults.slug));
  const [selectedParentId, setSelectedParentId] = useState(initialSelection.parentId);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState(initialSelection.childId);
  const [tagsValue, setTagsValue] = useState(defaults.tags);

  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [queuedImages, setQueuedImages] = useState<QueuedImage[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [autoSubmit, setAutoSubmit] = useState(false);
  const [creating, setCreating] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [createdDraft, setCreatedDraft] = useState<{
    productId: string;
    versionId: string | null;
  } | null>(null);
  const [uploadedFilesCount, setUploadedFilesCount] = useState(0);
  const [uploadedImagesCount, setUploadedImagesCount] = useState(0);

  const pending = enableInitialUploads ? creating : serverPending;

  useEffect(() => {
    if (enableInitialUploads) {
      folderInputRef.current?.setAttribute("webkitdirectory", "");
    }
  }, [enableInitialUploads]);

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  const availableSubcategories = useMemo(
    () => (selectedParentId ? childrenByParentId.get(selectedParentId) ?? [] : []),
    [childrenByParentId, selectedParentId],
  );
  const effectiveCategoryId = selectedSubCategoryId || selectedParentId;
  const selectedCategory = categoryById.get(effectiveCategoryId);
  const selectedParentCategory = categoryById.get(selectedParentId);
  const suggestedTags = getCompatibilityTagsForCategory(
    selectedCategory?.slug,
    selectedParentCategory?.slug,
  );
  const activeTagSet = new Set(
    tagsValue
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );

  function toggleSuggestedTag(tag: string) {
    const normalized = tag.trim().toLowerCase();
    const list = tagsValue
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (list.includes(normalized)) {
      setTagsValue(list.filter((item) => item !== normalized).join(", "));
    } else if (list.length < 12) {
      setTagsValue([...list, normalized].join(", "));
    }
  }

  function handleTitleChange(nextTitle: string) {
    setTitleValue(nextTitle);
    if (!productId && !slugManuallyEdited) {
      setSlugValue(slugify(nextTitle));
    }
  }

  function queueDeliverableFiles(list: FileList | File[] | null, replaceExisting = false) {
    const picked = list ? Array.from(list) : [];
    if (filesInputRef.current) filesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (picked.length === 0) return;

    setFileError(null);

    if (picked.some((file) => file.size <= 0)) {
      const nonEmpty = picked.filter((file) => file.size > 0);
      if (nonEmpty.length === 0) {
        setFileError(
          "Selected files are empty. If you dragged a folder, use the “Upload a folder” button instead.",
        );
        return;
      }
    }

    const validNonEmpty = picked.filter((file) => file.size > 0);
    if (validNonEmpty.length > 2500) {
      setFileError(
        `Too many individual files (${validNonEmpty.length}). Zip the folder on your PC first and upload the .zip file.`,
      );
      return;
    }

    const baseList = replaceExisting ? [] : queuedFiles;
    const nextList = [...baseList, ...validNonEmpty];

    if (nextList.length === 1) {
      const single = nextList[0];
      if (single && !single.webkitRelativePath && !isAllowedProductFile(single.name)) {
        setFileError(
          `“${single.name}” uses an unsupported file extension. Upload an archive (.zip), plugin, script, asset, or pick multiple files/a folder to pack into .zip.`,
        );
        return;
      }
    }

    const totalBytes = nextList.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > maxFileBytes) {
      setFileError(
        `Selected files add up to ${formatBytes(totalBytes)}, exceeding the ${Math.round(maxFileBytes / (1024 * 1024))} MB limit.`,
      );
      return;
    }

    setQueuedFiles(nextList);
  }

  async function queueImages(list: FileList | null) {
    const picked = list ? Array.from(list) : [];
    if (imagesInputRef.current) imagesInputRef.current.value = "";
    if (picked.length === 0) return;

    setImageError(null);
    setImageNotice(null);

    const remainingSlots = maxImages - (uploadedImagesCount + queuedImages.length);
    if (remainingSlots <= 0) {
      setImageError(`You can upload up to ${maxImages} images per listing.`);
      return;
    }

    const slice = picked.slice(0, remainingSlots);
    const additions: QueuedImage[] = [];

    for (const file of slice) {
      if (!isAllowedImageFile(file.name)) {
        setImageError(`“${file.name}” is not a supported image (use PNG, JPG, WebP, GIF or AVIF).`);
        continue;
      }
      if (file.size <= 0) {
        setImageError(`“${file.name}” is empty.`);
        continue;
      }
      if (file.size > maxImageBytes) {
        setImageError(
          `“${file.name}” is ${formatBytes(file.size)}, over the ${Math.round(maxImageBytes / (1024 * 1024))} MB limit.`,
        );
        continue;
      }

      const dims = await readImageDimensions(file);
      if (
        dims &&
        (dims.width !== RECOMMENDED_IMAGE.width || dims.height !== RECOMMENDED_IMAGE.height)
      ) {
        setImageNotice(
          `Image “${file.name}” is ${dims.width}×${dims.height}. Recommended storefront cover size is ${RECOMMENDED_IMAGE.width}×${RECOMMENDED_IMAGE.height} (2:1).`,
        );
      }

      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      additions.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl,
      });
    }

    if (picked.length > remainingSlots) {
      setImageError(`Only added the first ${remainingSlots} image(s) to stay within the ${maxImages}-image limit.`);
    }

    if (additions.length > 0) {
      setQueuedImages((prev) => [...prev, ...additions]);
    }
  }

  function removeQueuedImage(id: string) {
    setQueuedImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrlsRef.current.delete(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }

  async function packFilesIfNeeded(files: File[], draftTitle: string): Promise<File> {
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
    const baseName = root || slugValue || draftTitle || "product-files";
    const archiveName = `${safeArchiveBaseName(baseName)}.zip`;
    return new File([archive], archiveName, { type: "application/zip" });
  }

  async function handleInitialCreateSubmit(formElement: HTMLFormElement) {
    setCreating(true);
    setCustomState(null);
    setFileError(null);
    setImageError(null);

    try {
      if ((queuedFiles.length > 0 || queuedImages.length > 0) && !isSupabaseConfigured) {
        setCustomState({
          status: "error",
          message:
            "File storage is not configured in this environment. Clear the queued files to save a text-only draft, or configure Supabase storage keys.",
        });
        return;
      }

      setStage(createdDraft ? "Updating draft listing…" : "Creating listing draft…");
      const formData = new FormData(formElement);
      const draftRes = await saveProductDraftForUploadAction(formData, createdDraft?.productId);

      if (!draftRes.ok) {
        setCustomState(draftRes.state);
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const draft = { productId: draftRes.productId, versionId: draftRes.versionId };
      setCreatedDraft(draft);

      let totalAttachedFiles = uploadedFilesCount;
      const supabase =
        queuedFiles.length > 0 || queuedImages.length > 0 ? createSupabaseBrowserClient() : null;

      if (queuedFiles.length > 0 && supabase) {
        const deliverable = await packFilesIfNeeded(queuedFiles, titleValue);

        setStage(`Authorising upload for ${deliverable.name}…`);
        const ticket: UploadTicket = await requestProductFileUpload({
          productId: draft.productId,
          fileName: deliverable.name,
          sizeBytes: deliverable.size,
        });
        if (!ticket.ok) {
          throw new Error(ticket.error);
        }

        setStage(`Uploading ${deliverable.name} (${formatBytes(deliverable.size)})…`);
        const { error: uploadError } = await supabase.storage
          .from(ticket.bucket)
          .uploadToSignedUrl(ticket.path, ticket.token, deliverable, {
            contentType: deliverable.type || undefined,
          });
        if (uploadError) {
          throw new Error(`File upload failed: ${uploadError.message}`);
        }

        setStage("Verifying uploaded file…");
        const finalRes = await finalizeProductFileAction({
          productId: draft.productId,
          path: ticket.path,
          fileName: deliverable.name,
          versionId: draft.versionId,
        });
        if (finalRes.status === "error") {
          throw new Error(finalRes.message ?? "Could not register uploaded file.");
        }

        totalAttachedFiles += 1;
        setUploadedFilesCount(totalAttachedFiles);
        setQueuedFiles([]);
      }

      if (queuedImages.length > 0 && supabase) {
        const remaining = [...queuedImages];
        for (let idx = 0; idx < queuedImages.length; idx += 1) {
          const item = queuedImages[idx];
          if (!item) continue;

          setStage(`Uploading screenshot ${idx + 1} of ${queuedImages.length}…`);
          const ticket = await requestProductImageUpload({
            productId: draft.productId,
            fileName: item.file.name,
            sizeBytes: item.file.size,
          });
          if (!ticket.ok) {
            throw new Error(ticket.error);
          }

          const { error: uploadError } = await supabase.storage
            .from(ticket.bucket)
            .uploadToSignedUrl(ticket.path, ticket.token, item.file, {
              contentType: item.file.type || undefined,
            });
          if (uploadError) {
            throw new Error(`Screenshot “${item.file.name}” failed: ${uploadError.message}`);
          }

          const finalRes = await finalizeProductImageAction({
            productId: draft.productId,
            path: ticket.path,
          });
          if (finalRes.status === "error") {
            throw new Error(finalRes.message ?? "Could not save screenshot.");
          }

          URL.revokeObjectURL(item.previewUrl);
          previewUrlsRef.current.delete(item.previewUrl);
          remaining.shift();
          setQueuedImages([...remaining]);
          setUploadedImagesCount((count) => count + 1);
        }
      }

      let submitted = false;
      if (autoSubmit && totalAttachedFiles > 0) {
        setStage("Submitting listing for review…");
        const submitRes = await submitCreatedProductForReviewAction(draft.productId);
        if (submitRes.status === "success") {
          submitted = true;
        }
      }

      router.push(
        `/dashboard/products/${draft.productId}?created=1${submitted ? "&submitted=1" : ""}`,
      );
      router.refresh();
    } catch (cause) {
      setCustomState({
        status: "error",
        message: cause instanceof Error ? cause.message : "Could not finish creating the product.",
      });
    } finally {
      setCreating(false);
      setStage(null);
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    if (!enableInitialUploads) return;
    event.preventDefault();
    void handleInitialCreateSubmit(event.currentTarget);
  }

  const totalQueuedBytes = queuedFiles.reduce((sum, file) => sum + file.size, 0);
  const willAutoZip =
    queuedFiles.length > 1 || queuedFiles.some((file) => Boolean(file.webkitRelativePath));
  const hasAnyDeliverableFile = queuedFiles.length > 0 || uploadedFilesCount > 0;

  let effectiveSubmitLabel = submitLabel;
  if (enableInitialUploads) {
    if (autoSubmit && hasAnyDeliverableFile) {
      effectiveSubmitLabel = "Create listing, upload & submit for review";
    } else if (queuedFiles.length > 0 || queuedImages.length > 0) {
      effectiveSubmitLabel = "Create listing & upload files";
    }
  }

  return (
    <form
      ref={formRef}
      action={enableInitialUploads ? undefined : formAction}
      onSubmit={handleFormSubmit}
      className="space-y-4"
    >
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      <Message state={state} />

      {createdDraft && state.status === "error" ? (
        <Alert tone="info" title="Draft saved">
          Your draft was already created so nothing was lost. You can fix the issue and click the
          button below to retry uploading, or{" "}
          <Link
            href={`/dashboard/products/${createdDraft.productId}`}
            className="font-semibold underline"
          >
            open the draft editor
          </Link>
          .
        </Alert>
      ) : null}

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Title" htmlFor="title" error={state.fieldErrors?.title}>
          <Input
            id="title"
            name="title"
            value={titleValue}
            onChange={(event) => handleTitleChange(event.target.value)}
            maxLength={120}
            required
          />
        </Field>
        <Field
          label="Listing page link"
          htmlFor="slug"
          error={state.fieldErrors?.slug}
          hint={
            enableInitialUploads
              ? "Storefront web address (auto-filled from title). Product files are uploaded from your PC below."
              : "Lowercase letters, numbers and hyphens for the storefront /product/ link."
          }
        >
          <div className="flex h-10 w-full overflow-hidden rounded-[9px] border border-line bg-surface transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
            <span className="flex shrink-0 select-none items-center border-r border-line bg-elevated px-2.5 font-mono text-[12px] text-ink-muted">
              /product/
            </span>
            <input
              id="slug"
              name="slug"
              value={slugValue}
              onChange={(event) => {
                setSlugManuallyEdited(true);
                setSlugValue(event.target.value);
              }}
              onBlur={() => {
                if (slugValue.trim()) {
                  setSlugValue(slugify(slugValue));
                }
              }}
              placeholder="my-cool-plugin"
              maxLength={120}
              required
              className="min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] text-ink outline-none placeholder:text-ink-subtle"
            />
          </div>
        </Field>
      </div>

      <input type="hidden" name="categoryId" value={effectiveCategoryId} />

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Category" htmlFor="parentCategoryId" error={state.fieldErrors?.categoryId}>
          <Select
            id="parentCategoryId"
            value={selectedParentId}
            onChange={(event) => {
              setSelectedParentId(event.target.value);
              setSelectedSubCategoryId("");
            }}
            required
          >
            <option value="">Choose a category…</option>
            {topCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Subcategory"
          htmlFor="subCategoryId"
          hint={
            availableSubcategories.length > 0
              ? `Pick a specific ${selectedParentCategory?.name ?? "category"} type.`
              : "No subcategories available."
          }
        >
          <Select
            id="subCategoryId"
            value={selectedSubCategoryId}
            onChange={(event) => setSelectedSubCategoryId(event.target.value)}
            disabled={availableSubcategories.length === 0}
          >
            <option value="">
              {availableSubcategories.length > 0
                ? `General (${selectedParentCategory?.name ?? "All"})`
                : "None"}
            </option>
            {availableSubcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Version" htmlFor="version" error={state.fieldErrors?.version} hint="e.g. 1.0.0">
          <Input id="version" name="version" defaultValue={defaults.version} required maxLength={32} />
        </Field>
        <Field label="License" htmlFor="licenseType" error={state.fieldErrors?.licenseType}>
          <Select id="licenseType" name="licenseType" defaultValue={defaults.licenseType}>
            {LICENSE_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Short summary"
        htmlFor="shortDescription"
        error={state.fieldErrors?.shortDescription}
        hint="One line shown on cards and search results."
      >
        <Input
          id="shortDescription"
          name="shortDescription"
          defaultValue={defaults.shortDescription}
          maxLength={240}
          required
        />
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        error={state.fieldErrors?.description}
        hint="Customize with headings, bold text, bullet lists, colors, links, images, spoilers or code blocks using BBCode."
      >
        <BBCodeEditor
          id="description"
          name="description"
          rows={9}
          defaultValue={defaults.description}
          maxLength={20000}
          required
        />
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field
          label="Price"
          htmlFor="price"
          error={state.fieldErrors?.price}
          hint="Enter 0 for a free listing, or 0.50+ for paid."
        >
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={defaults.price}
            placeholder="0 or 19.99"
            required
          />
        </Field>
        <Field
          label="Sale price"
          htmlFor="salePrice"
          error={state.fieldErrors?.salePrice}
          hint="Optional, must be below the regular price."
        >
          <Input
            id="salePrice"
            name="salePrice"
            inputMode="decimal"
            defaultValue={defaults.salePrice}
            placeholder="Optional"
          />
        </Field>
        <Field label="Currency" htmlFor="currency" error={state.fieldErrors?.currency}>
          <Select id="currency" name="currency" defaultValue={defaults.currency}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="space-y-2">
        <Field
          label="Tags"
          htmlFor="tags"
          error={state.fieldErrors?.tags}
          hint="Comma separated, up to 12. Click suggestions below to add."
        >
          <Input
            id="tags"
            name="tags"
            value={tagsValue}
            onChange={(event) => setTagsValue(event.target.value)}
            maxLength={300}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="subtle text-[11.5px]">
            Suggested{selectedCategory ? ` for ${selectedCategory.name}` : ""}:
          </span>
          {suggestedTags.map((tag) => {
            const active = activeTagSet.has(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleSuggestedTag(tag)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11.5px] transition-colors",
                  active
                    ? "border-accent bg-accent-quiet font-medium text-accent"
                    : "border-line bg-elevated text-ink-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {active ? `✓ ${tag}` : `+ ${tag}`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field
          label="Live demo URL"
          htmlFor="demoUrl"
          error={state.fieldErrors?.demoUrl}
          hint="Optional interactive sandbox, test site, or preview showcase."
        >
          <Input
            id="demoUrl"
            name="demoUrl"
            type="url"
            defaultValue={defaults.demoUrl}
            placeholder="https://demo.example.com"
          />
        </Field>
        <Field
          label="Video preview URL"
          htmlFor="videoUrl"
          error={state.fieldErrors?.videoUrl}
          hint="Optional YouTube or Vimeo link shown in the listing gallery."
        >
          <Input
            id="videoUrl"
            name="videoUrl"
            type="url"
            defaultValue={defaults.videoUrl}
            placeholder="https://youtube.com/watch?v=..."
          />
        </Field>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field
          label="Compatibility"
          htmlFor="compatibility"
          error={state.fieldErrors?.compatibility}
          hint="Versions of the engine or platform this supports."
        >
          <Textarea
            id="compatibility"
            name="compatibility"
            rows={3}
            defaultValue={defaults.compatibility}
            maxLength={2000}
          />
        </Field>
        <Field
          label="Requirements"
          htmlFor="requirements"
          error={state.fieldErrors?.requirements}
          hint="What the buyer needs before installing."
        >
          <Textarea
            id="requirements"
            name="requirements"
            rows={3}
            defaultValue={defaults.requirements}
            maxLength={2000}
          />
        </Field>
      </div>

      <Field
        label="License terms"
        htmlFor="licenseText"
        error={state.fieldErrors?.licenseText}
        hint="Optional. Leave blank to use the platform's standard license."
      >
        <Textarea
          id="licenseText"
          name="licenseText"
          rows={4}
          defaultValue={defaults.licenseText}
          maxLength={8000}
        />
      </Field>

      {enableInitialUploads ? (
        <div className="space-y-4 border-t border-line pt-4">
          {!isSupabaseConfigured ? (
            <Alert tone="warning" title="Storage uploads unavailable">
              Supabase Storage is not configured in this environment yet, so file uploads are disabled.
              You can still create the listing draft and attach files after configuring storage.
            </Alert>
          ) : null}

          <div className="surface-elevated space-y-3 rounded-[10px] border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[13.5px] font-semibold text-ink">
                  Product files (upload from your PC)
                </p>
                <p className="muted text-[12px]">
                  Pick one file (.zip, .jar, .rbxm, .unitypackage, .pdf, etc.), multiple files, or an
                  entire folder. Multiple files are packed into a single .zip automatically.
                </p>
              </div>
              <span className="subtle font-mono text-[11px]">
                Max {Math.round(maxFileBytes / (1024 * 1024))} MB
              </span>
            </div>

            {fileError ? <Alert tone="error">{fileError}</Alert> : null}

            {uploadedFilesCount > 0 ? (
              <Alert tone="success">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  {uploadedFilesCount} file package already uploaded to this draft.
                </span>
              </Alert>
            ) : null}

            <div
              onDragOver={(event) => {
                event.preventDefault();
                if (!pending && isSupabaseConfigured) setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                if (!pending && isSupabaseConfigured) {
                  queueDeliverableFiles(event.dataTransfer.files);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-[9px] border border-dashed px-4 py-5 text-center transition-colors",
                dragActive ? "border-accent bg-accent-quiet/40" : "border-line-strong bg-surface",
              )}
            >
              <FileArchive className="size-6 text-ink-subtle" aria-hidden />
              <div className="space-y-1">
                <p className="text-[12.5px] font-medium text-ink">
                  Drag and drop product files here, or pick from your PC
                </p>
                <p className="subtle text-[11.5px]">
                  Files are stored in a private bucket and delivered only to verified buyers.
                </p>
              </div>

              <input
                ref={filesInputRef}
                type="file"
                multiple
                disabled={pending || !isSupabaseConfigured}
                className="hidden"
                onChange={(event) => queueDeliverableFiles(event.target.files)}
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                disabled={pending || !isSupabaseConfigured}
                className="hidden"
                onChange={(event) => queueDeliverableFiles(event.target.files, true)}
              />

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending || !isSupabaseConfigured}
                  onClick={() => filesInputRef.current?.click()}
                >
                  <Upload className="size-3.5" aria-hidden />
                  Choose files from PC
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending || !isSupabaseConfigured}
                  onClick={() => folderInputRef.current?.click()}
                >
                  <FolderUp className="size-3.5" aria-hidden />
                  Upload folder
                </Button>
              </div>
            </div>

            {queuedFiles.length > 0 ? (
              <div className="space-y-2 rounded-[8px] border border-line bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-ink">
                    {queuedFiles.length} file{queuedFiles.length === 1 ? "" : "s"} queued ·{" "}
                    {formatBytes(totalQueuedBytes)}
                    {willAutoZip ? " (auto-packed into .zip)" : ""}
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setQueuedFiles([])}
                    className="inline-flex items-center gap-1 text-[11.5px] text-ink-muted hover:text-critical"
                  >
                    <Trash2 className="size-3" aria-hidden />
                    Clear files
                  </button>
                </div>

                <ul className="max-h-40 space-y-1 overflow-y-auto text-[12px]">
                  {queuedFiles.slice(0, 15).map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-[6px] bg-elevated/60 px-2.5 py-1"
                    >
                      <span className="min-w-0 truncate font-mono text-[11.5px] text-ink">
                        {file.webkitRelativePath || file.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="subtle tabular-nums">{formatBytes(file.size)}</span>
                        {queuedFiles.length <= 20 ? (
                          <button
                            type="button"
                            disabled={pending}
                            aria-label={`Remove ${file.name}`}
                            onClick={() =>
                              setQueuedFiles((prev) => prev.filter((_, idx) => idx !== index))
                            }
                            className="text-ink-subtle hover:text-critical"
                          >
                            <X className="size-3.5" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                  {queuedFiles.length > 15 ? (
                    <li className="subtle px-2 py-1 text-[11.5px]">
                      …and {queuedFiles.length - 15} more files in selection.
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="surface-elevated space-y-3 rounded-[10px] border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[13.5px] font-semibold text-ink">
                  Screenshots &amp; cover thumbnail (from your PC)
                </p>
                <p className="muted text-[12px]">
                  Optional PNG, JPG, WebP, GIF or AVIF images (1024×512 recommended). The first image
                  becomes the card cover.
                </p>
              </div>
              <span className="subtle font-mono text-[11px]">
                {uploadedImagesCount + queuedImages.length} / {maxImages}
              </span>
            </div>

            {imageError ? <Alert tone="error">{imageError}</Alert> : null}
            {imageNotice ? <Alert tone="warning">{imageNotice}</Alert> : null}

            <input
              ref={imagesInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              disabled={pending || !isSupabaseConfigured || uploadedImagesCount + queuedImages.length >= maxImages}
              className="hidden"
              onChange={(event) => void queueImages(event.target.files)}
            />

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={
                pending ||
                !isSupabaseConfigured ||
                uploadedImagesCount + queuedImages.length >= maxImages
              }
              onClick={() => imagesInputRef.current?.click()}
            >
              <ImagePlus className="size-3.5" aria-hidden />
              Add screenshots from PC
            </Button>

            {queuedImages.length > 0 ? (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {queuedImages.map((item, idx) => (
                  <li
                    key={item.id}
                    className="group relative overflow-hidden rounded-[8px] border border-line bg-surface"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="aspect-[2/1] w-full object-cover"
                    />
                    {idx === 0 && uploadedImagesCount === 0 ? (
                      <span className="absolute left-1.5 top-1.5 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-surface">
                        Cover
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() => removeQueuedImage(item.id)}
                      className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-surface/90 text-ink shadow-xs hover:text-critical"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                    <p className="truncate px-2 py-1 text-[11px] text-ink-muted">{item.file.name}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <label className="flex items-start gap-2.5 rounded-[9px] border border-line bg-surface px-3.5 py-3 text-[12.5px]">
            <input
              type="checkbox"
              checked={autoSubmit}
              disabled={pending || !hasAnyDeliverableFile}
              onChange={(event) => setAutoSubmit(event.target.checked)}
              className="mt-0.5 size-4 rounded border-line-strong text-accent focus:ring-accent"
            />
            <span className="space-y-0.5">
              <span className="block font-medium text-ink">
                Submit listing for admin review right after upload
              </span>
              <span className="subtle block text-[11.5px]">
                {hasAnyDeliverableFile
                  ? "An administrator will review your listing and files so it can go live on the storefront."
                  : "Attach at least one product file above to enable one-click submission."}
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {pending && stage ? (
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-accent">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {stage}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? (stage ?? "Saving…") : effectiveSubmitLabel}
      </Button>
    </form>
  );
}

export function VersionForm({
  action,
  productId,
}: {
  action: FormAction;
  productId: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3.5">
      <input type="hidden" name="productId" value={productId} />
      <Message state={state} />

      <div className="grid gap-3.5 sm:grid-cols-[180px_1fr]">
        <Field label="Version" htmlFor="version-new" error={state.fieldErrors?.version}>
          <Input id="version-new" name="version" placeholder="1.1.0" required maxLength={32} />
        </Field>
        <Field label="Update title" htmlFor="updateTitle" error={state.fieldErrors?.updateTitle}>
          <Input
            id="updateTitle"
            name="updateTitle"
            placeholder="e.g. Major performance improvements & new modules"
            maxLength={140}
          />
        </Field>
      </div>

      <Field label="Update message / Changelog" htmlFor="changelog" error={state.fieldErrors?.changelog}>
        <BBCodeEditor
          id="changelog"
          name="changelog"
          rows={5}
          maxLength={8000}
          required
          placeholder="Describe what changed for buyers using BBCode ([h2], [list][*]..., [b], [color], etc.)."
        />
      </Field>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Publishing…" : "Publish version"}
      </Button>
    </form>
  );
}
