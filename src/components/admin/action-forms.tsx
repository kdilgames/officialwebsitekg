"use client";

import type { ReactNode } from "react";
import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils/cn";

export type StateAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
export type VoidAction = (formData: FormData) => Promise<void>;

function Message({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>;
}

function HiddenFields({ fields }: { fields: Record<string, string | number | null | undefined> }) {
  return (
    <>
      {Object.entries(fields).map(([name, value]) =>
        value === null || value === undefined ? null : (
          <input key={name} type="hidden" name={name} value={String(value)} />
        ),
      )}
    </>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Working…",
  variant = "secondary",
  size = "sm",
  disabled,
  confirm,
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  disabled?: boolean;
  confirm?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      name={name}
      value={value}
      variant={variant}
      size={size}
      disabled={pending || disabled}
      className={className}
      onClick={
        confirm
          ? (event) => {
              if (!window.confirm(confirm)) event.preventDefault();
            }
          : undefined
      }
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}

/**
 * A single button that posts fixed values to a Server Action. No state is
 * carried in the URL, so the action cannot be replayed with different values.
 */
export function ActionButton({
  action,
  fields,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
  className,
}: {
  action: VoidAction;
  fields: Record<string, string | number | null | undefined>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  confirm?: string;
  className?: string;
}) {
  return (
    <form action={action} className={cn("inline-flex", className)}>
      <HiddenFields fields={fields} />
      <SubmitButton variant={variant} size={size} confirm={confirm}>
        {children}
      </SubmitButton>
    </form>
  );
}

/**
 * A disclosure that reveals a required reason before the action can be posted.
 * Used for anything destructive or user-visible, so a decision always carries
 * an explanation.
 */
export function ReasonForm({
  action,
  fields,
  label,
  placeholder,
  submitLabel,
  variant = "danger",
  confirm,
  className,
}: {
  action: VoidAction;
  fields: Record<string, string | number | null | undefined>;
  label: string;
  placeholder?: string;
  submitLabel: string;
  variant?: ButtonVariant;
  confirm?: string;
  className?: string;
}) {
  const reasonId = useId();

  return (
    <details className={cn("group", className)}>
      <summary className="btn btn-secondary btn-sm w-fit list-none [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <form action={action} className="surface-elevated mt-2 space-y-2 p-2.5">
        <HiddenFields fields={fields} />
        <label className="label mb-0" htmlFor={reasonId}>
          Reason (shown to the account owner)
        </label>
        <Textarea
          id={reasonId}
          name="reason"
          rows={3}
          required
          maxLength={2000}
          placeholder={placeholder ?? "Explain the decision in a sentence or two."}
        />
        <SubmitButton variant={variant} confirm={confirm}>
          {submitLabel}
        </SubmitButton>
      </form>
    </details>
  );
}

/**
 * A button-driven form for actions that report their outcome inline.
 */
export function StateActionButton({
  action,
  fields,
  children,
  pendingLabel,
  variant = "secondary",
  size = "sm",
  confirm,
  className,
}: {
  action: StateAction;
  fields: Record<string, string | number | null | undefined>;
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  confirm?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className={cn("space-y-2", className)}>
      <Message state={state} />
      <HiddenFields fields={fields} />
      <SubmitButton variant={variant} size={size} confirm={confirm} pendingLabel={pendingLabel}>
        {children}
      </SubmitButton>
    </form>
  );
}

/**
 * A form wrapper for actions that report back through `useActionState`. Field
 * errors are surfaced by the concrete forms built on top of it.
 */
export function StateForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  variant = "primary",
  fields,
  footer,
  className,
}: {
  action: StateAction;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  fields?: Record<string, string | number | null | undefined>;
  footer?: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className={cn("space-y-3", className)}>
      <Message state={state} />
      {fields ? <HiddenFields fields={fields} /> : null}
      {children}
      <Button type="submit" variant={variant} size="sm" disabled={pending}>
        {pending ? (pendingLabel ?? "Working…") : submitLabel}
      </Button>
      {footer}
    </form>
  );
}
