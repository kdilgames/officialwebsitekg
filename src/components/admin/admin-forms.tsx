"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

function Message({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>;
}

// ---------------------------------------------------------------- sellers

export function SellerDecisionForm({ action, sellerId }: { action: FormAction; sellerId: string }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <Message state={state} />
      <input type="hidden" name="sellerId" value={sellerId} />

      <Field
        label="Note to the applicant"
        htmlFor={`reviewNote-${sellerId}`}
        error={state.fieldErrors?.reviewNote}
        hint="Optional on approval, required context when you reject."
      >
        <Textarea id={`reviewNote-${sellerId}`} name="reviewNote" rows={2} maxLength={2000} />
      </Field>

      <Field
        label="Commission override (%)"
        htmlFor={`commissionPercent-${sellerId}`}
        error={state.fieldErrors?.commissionPercent}
        hint="Optional. Leave blank to use the global, category or seller rules instead."
      >
        <Input
          id={`commissionPercent-${sellerId}`}
          name="commissionPercent"
          type="number"
          min={0}
          max={90}
          step="0.01"
          placeholder="e.g. 15"
        />
      </Field>

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Approving…" : "Approve seller"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- categories

export type CategoryDefaults = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  parentId: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_CATEGORY: CategoryDefaults = {
  name: "",
  slug: "",
  description: "",
  icon: "",
  parentId: "",
  sortOrder: "0",
  isActive: true,
};

export function CategoryForm({
  action,
  categories,
  defaults = EMPTY_CATEGORY,
  categoryId,
  idPrefix = "",
  submitLabel = "Create category",
}: {
  action: FormAction;
  categories: Array<{ id: string; name: string }>;
  defaults?: CategoryDefaults;
  categoryId?: string;
  /** Keeps element ids unique when several forms are rendered on one page. */
  idPrefix?: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3.5">
      <Message state={state} />
      {categoryId ? <input type="hidden" name="categoryId" value={categoryId} /> : null}

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${idPrefix}cat-name`} error={state.fieldErrors?.name}>
          <Input
            id={`${idPrefix}cat-name`}
            name="name"
            defaultValue={defaults.name}
            maxLength={60}
            required
          />
        </Field>
        <Field
          label="Slug"
          htmlFor={`${idPrefix}cat-slug`}
          error={state.fieldErrors?.slug}
          hint="Used in the storefront URL."
        >
          <Input
            id={`${idPrefix}cat-slug`}
            name="slug"
            defaultValue={defaults.slug}
            maxLength={60}
            required
          />
        </Field>
      </div>

      <Field
        label="Description"
        htmlFor={`${idPrefix}cat-description`}
        error={state.fieldErrors?.description}
      >
        <Textarea
          id={`${idPrefix}cat-description`}
          name="description"
          rows={2}
          maxLength={400}
          defaultValue={defaults.description}
        />
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field label="Parent" htmlFor={`${idPrefix}cat-parent`} error={state.fieldErrors?.parentId}>
          <Select id={`${idPrefix}cat-parent`} name="parentId" defaultValue={defaults.parentId}>
            <option value="">Top level</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Sort order"
          htmlFor={`${idPrefix}cat-sortOrder`}
          error={state.fieldErrors?.sortOrder}
        >
          <Input
            id={`${idPrefix}cat-sortOrder`}
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={defaults.sortOrder}
          />
        </Field>
        <Field
          label="Visibility"
          htmlFor={`${idPrefix}cat-isActive`}
          error={state.fieldErrors?.isActive}
        >
          <Select
            id={`${idPrefix}cat-isActive`}
            name="isActive"
            defaultValue={defaults.isActive ? "true" : "false"}
          >
            <option value="true">Active</option>
            <option value="false">Hidden</option>
          </Select>
        </Field>
      </div>

      <Field
        label="Icon name"
        htmlFor={`${idPrefix}cat-icon`}
        error={state.fieldErrors?.icon}
        hint="Optional Lucide icon identifier, for example “boxes”."
      >
        <Input
          id={`${idPrefix}cat-icon`}
          name="icon"
          defaultValue={defaults.icon}
          maxLength={60}
        />
      </Field>

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- commissions

export type CommissionRuleDefaults = {
  scope: string;
  targetId: string;
  ratePercent: string;
  note: string;
  isActive: boolean;
};

export function CommissionRuleForm({
  action,
  categories,
  sellers,
  products,
  defaults,
}: {
  action: FormAction;
  categories: Array<{ id: string; name: string }>;
  sellers: Array<{ id: string; storeName: string }>;
  products: Array<{ id: string; title: string }>;
  defaults?: CommissionRuleDefaults;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const [scope, setScope] = useState(defaults?.scope ?? "GLOBAL");

  const targets =
    scope === "CATEGORY"
      ? categories.map((row) => ({ id: row.id, label: row.name }))
      : scope === "SELLER"
        ? sellers.map((row) => ({ id: row.id, label: row.storeName }))
        : scope === "PRODUCT"
          ? products.map((row) => ({ id: row.id, label: row.title }))
          : [];

  return (
    <form action={formAction} className="space-y-3.5">
      <Message state={state} />

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Applies to" htmlFor="rule-scope" error={state.fieldErrors?.scope}>
          <Select
            id="rule-scope"
            name="scope"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          >
            <option value="GLOBAL">Everything (global default)</option>
            <option value="CATEGORY">A category</option>
            <option value="SELLER">A seller</option>
            <option value="PRODUCT">A single product</option>
          </Select>
        </Field>

        <Field
          label="Target"
          htmlFor="rule-target"
          error={state.fieldErrors?.targetId}
          hint={scope === "GLOBAL" ? "The global rate has no target." : undefined}
        >
          <Select
            id="rule-target"
            name="targetId"
            defaultValue={defaults?.targetId ?? ""}
            disabled={scope === "GLOBAL"}
          >
            <option value="">{scope === "GLOBAL" ? "Not applicable" : "Choose a target…"}</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field
          label="Platform commission (%)"
          htmlFor="rule-rate"
          error={state.fieldErrors?.ratePercent}
          hint="15 means the platform keeps 15% and the seller receives 85%."
        >
          <Input
            id="rule-rate"
            name="ratePercent"
            type="number"
            min={0}
            max={90}
            step="0.01"
            defaultValue={defaults?.ratePercent ?? "15"}
            required
          />
        </Field>
        <Field label="Status" htmlFor="rule-isActive" error={state.fieldErrors?.isActive}>
          <Select id="rule-isActive" name="isActive" defaultValue={defaults?.isActive === false ? "false" : "true"}>
            <option value="true">Active</option>
            <option value="false">Disabled</option>
          </Select>
        </Field>
      </div>

      <Field label="Note" htmlFor="rule-note" error={state.fieldErrors?.note}>
        <Input
          id="rule-note"
          name="note"
          maxLength={300}
          defaultValue={defaults?.note ?? ""}
          placeholder="Why this rate exists"
        />
      </Field>

      <p className="subtle text-[11.5px] leading-relaxed">
        Rates apply to new orders only. Orders that have already been placed keep the commission that
        was written onto their order lines.
      </p>

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save rate"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- refunds

export function RefundDecisionForm({
  action,
  refundId,
}: {
  action: FormAction;
  refundId: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-2.5">
      <Message state={state} />
      <input type="hidden" name="refundId" value={refundId} />
      <Textarea
        name="adminNote"
        rows={2}
        maxLength={2000}
        placeholder="What you checked and what you decided"
        aria-label="Decision note"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="APPROVED" variant="primary" size="sm" disabled={pending}>
          Approve request
        </Button>
        <Button type="submit" name="decision" value="REJECTED" size="sm" disabled={pending}>
          Decline request
        </Button>
      </div>
      <p className="subtle text-[11.5px]">
        Approving only records the decision. Money moves when you send the refund to Stripe.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------- reports

export function ReportDecisionForm({
  action,
  reportId,
  status,
}: {
  action: FormAction;
  reportId: string;
  status: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-2.5">
      <Message state={state} />
      <input type="hidden" name="reportId" value={reportId} />

      <Field label="Status" htmlFor={`report-status-${reportId}`} error={state.fieldErrors?.status}>
        <Select id={`report-status-${reportId}`} name="status" defaultValue={status}>
          <option value="OPEN">Open</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </Select>
      </Field>

      <Field
        label="Finding"
        htmlFor={`report-note-${reportId}`}
        error={state.fieldErrors?.resolutionNote}
        hint="Required when you resolve or dismiss a report; the reporter is told the outcome."
      >
        <Textarea id={`report-note-${reportId}`} name="resolutionNote" rows={2} maxLength={2000} />
      </Field>

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Update report"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- tickets

export function TicketReplyForm({ action, ticketId }: { action: FormAction; ticketId: string }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-2.5">
      <Message state={state} />
      <input type="hidden" name="ticketId" value={ticketId} />
      <Textarea
        name="body"
        rows={3}
        required
        maxLength={4000}
        placeholder="Reply to the customer"
        aria-label="Reply"
      />
      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Sending…" : "Send reply"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- users

export function UserRoleForm({
  action,
  userId,
  role,
  disabled,
}: {
  action: (formData: FormData) => Promise<void>;
  userId: string;
  role: string;
  disabled?: boolean;
}) {
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <Select name="role" defaultValue={role} disabled={disabled} className="h-7 w-[104px] text-[12px]">
        <option value="USER">Buyer</option>
        <option value="SELLER">Seller</option>
        <option value="ADMIN">Admin</option>
      </Select>
      <Button type="submit" size="sm" disabled={disabled}>
        Save
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- settings

export function SiteSettingForm({
  action,
  defaults,
}: {
  action: FormAction;
  defaults?: { key: string; value: string; description: string };
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3.5">
      <Message state={state} />

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field
          label="Key"
          htmlFor="setting-key"
          error={state.fieldErrors?.key}
          hint="Lowercase letters, numbers, dots, dashes."
        >
          <Input
            id="setting-key"
            name="key"
            defaultValue={defaults?.key ?? ""}
            maxLength={64}
            required
            readOnly={Boolean(defaults?.key)}
          />
        </Field>
        <Field
          label="Value"
          htmlFor="setting-value"
          error={state.fieldErrors?.value}
          className="sm:col-span-2"
          hint={'Plain text, or JSON such as {"announcementEnabled":true}.'}
        >
          <Textarea
            id="setting-value"
            name="value"
            rows={2}
            required
            defaultValue={defaults?.value ?? ""}
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="setting-description" error={state.fieldErrors?.description}>
        <Input
          id="setting-description"
          name="description"
          maxLength={200}
          defaultValue={defaults?.description ?? ""}
        />
      </Field>

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Saving…" : defaults?.key ? "Update setting" : "Create setting"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- email admin access

export function GrantAdminEmailForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <Message state={state} />

      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="Email address"
          htmlFor="grant-admin-email"
          error={state.fieldErrors?.email}
          className="min-w-[240px] flex-1"
          hint="If this user has a verified account they become ADMIN right away; otherwise they are pre-authorized once their email is verified."
        >
          <Input
            id="grant-admin-email"
            name="email"
            type="email"
            required
            placeholder="teammate@studio.com"
          />
        </Field>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Authorizing…" : "Authorize admin email"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- quick platform settings

export function AnnouncementForm({
  action,
  defaults,
}: {
  action: FormAction;
  defaults: {
    enabled: boolean;
    text: string;
    href: string;
    linkLabel: string;
    tone: "info" | "accent" | "positive";
  };
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3.5">
      <Message state={state} />

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field label="Banner state" htmlFor="ann-enabled" error={state.fieldErrors?.enabled}>
          <Select
            id="ann-enabled"
            name="enabled"
            defaultValue={defaults.enabled ? "true" : "false"}
          >
            <option value="true">Active (visible on storefront)</option>
            <option value="false">Paused (saved, hidden)</option>
          </Select>
        </Field>
        <Field label="Tone" htmlFor="ann-tone" error={state.fieldErrors?.tone}>
          <Select id="ann-tone" name="tone" defaultValue={defaults.tone}>
            <option value="info">Neutral studio</option>
            <option value="accent">Cobalt accent</option>
            <option value="positive">Green highlight</option>
          </Select>
        </Field>
        <Field
          label="Link label (optional)"
          htmlFor="ann-linkLabel"
          error={state.fieldErrors?.linkLabel}
        >
          <Input
            id="ann-linkLabel"
            name="linkLabel"
            maxLength={40}
            defaultValue={defaults.linkLabel}
            placeholder="Browse deals"
          />
        </Field>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field
          label="Announcement message"
          htmlFor="ann-text"
          error={state.fieldErrors?.text}
          className="sm:col-span-2"
          hint="Leave blank and save to remove the announcement bar completely."
        >
          <Input
            id="ann-text"
            name="text"
            maxLength={200}
            defaultValue={defaults.text}
            placeholder="Launch weekend: use code LAUNCH20 for 20% off eligible resources."
          />
        </Field>
        <Field
          label="Link destination (optional)"
          htmlFor="ann-href"
          error={state.fieldErrors?.href}
          hint="e.g. /browse or https://..."
        >
          <Input
            id="ann-href"
            name="href"
            maxLength={400}
            defaultValue={defaults.href}
            placeholder="/browse"
          />
        </Field>
      </div>

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save announcement"}
      </Button>
    </form>
  );
}

export function DiscordInviteForm({
  action,
  defaultUrl,
}: {
  action: FormAction;
  defaultUrl: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <Message state={state} />

      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="Discord invite URL"
          htmlFor="discord-invite-url"
          error={state.fieldErrors?.url}
          className="min-w-[260px] flex-1"
          hint="Leave empty and save to hide Discord links across the storefront footer and seller onboarding."
        >
          <Input
            id="discord-invite-url"
            name="url"
            type="url"
            defaultValue={defaultUrl}
            placeholder="https://discord.gg/your-invite"
          />
        </Field>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save Discord URL"}
        </Button>
      </div>
    </form>
  );
}

export function DiscordWebhookForm({
  action,
  isConfigured,
  maskedPreview,
}: {
  action: FormAction;
  isConfigured: boolean;
  maskedPreview: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <Message state={state} />

      <Field
        label="Discord release webhook URL"
        htmlFor="discord-release-webhook-url"
        error={state.fieldErrors?.url}
        hint={
          maskedPreview
            ? `Currently active: ${maskedPreview}. Paste a new URL to replace it, send a test message, or remove it.`
            : "In Discord: Channel Settings -> Integrations -> Webhooks -> Copy Webhook URL."
        }
      >
        <Input
          id="discord-release-webhook-url"
          name="url"
          type="url"
          placeholder="https://discord.com/api/webhooks/..."
          autoComplete="off"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="intent" value="save" variant="primary" size="sm" disabled={pending}>
          {pending ? "Working…" : isConfigured ? "Update webhook" : "Save webhook"}
        </Button>
        <Button type="submit" name="intent" value="test" variant="secondary" size="sm" disabled={pending}>
          Send test message
        </Button>
        {isConfigured ? (
          <Button type="submit" name="intent" value="clear" variant="danger" size="sm" disabled={pending}>
            Remove webhook
          </Button>
        ) : null}
      </div>
    </form>
  );
}

