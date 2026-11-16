"use client";

import { useActionState } from "react";
import { Download, Lock, Package, Tag, Trash2, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Checkout is a server action so the amount charged is always recomputed from
 * the database. When Stripe is not configured the action returns an explicit
 * error and nothing is charged. When totalMinor is €0, Checkout claims instantly.
 */
export function CheckoutButton({
  action,
  disabled,
  isFree,
}: {
  action: FormAction;
  disabled?: boolean;
  isFree?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <Button type="submit" variant="primary" className="w-full" disabled={pending || disabled}>
          {isFree ? (
            <Download className="size-4" aria-hidden />
          ) : (
            <Lock className="size-4" aria-hidden />
          )}
          {pending
            ? isFree
              ? "Unlocking downloads…"
              : "Opening secure checkout…"
            : isFree
              ? "Claim free download"
              : "Continue to secure checkout"}
        </Button>
      </form>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
    </div>
  );
}

export function RemoveFromCartButton({
  action,
  itemId,
}: {
  action: (formData: FormData) => Promise<void>;
  itemId: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="itemId" value={itemId} />
      <Button type="submit" variant="ghost" size="sm">
        <Trash2 className="size-3.5" aria-hidden />
        Remove
      </Button>
    </form>
  );
}

export function AddBundleToCartButton({
  action,
  bundleId,
  next,
  disabled,
  disabledReason,
}: {
  action: FormAction;
  bundleId: string;
  next: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="bundleId" value={bundleId} />
        <input type="hidden" name="next" value={next} />
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={pending || disabled}
          title={disabled ? disabledReason : undefined}
        >
          <Package className="size-4" aria-hidden />
          {pending
            ? "Adding bundle…"
            : disabled
              ? (disabledReason ?? "Unavailable")
              : "Add bundle to cart"}
        </Button>
      </form>
      {state.status === "error" && state.message ? (
        <Alert tone="error" className="mt-2">
          {state.message}
        </Alert>
      ) : null}
    </div>
  );
}

export function RemoveBundleFromCartButton({
  action,
  bundleEntryId,
}: {
  action: (formData: FormData) => Promise<void>;
  bundleEntryId: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="bundleEntryId" value={bundleEntryId} />
      <Button type="submit" variant="ghost" size="sm">
        <Trash2 className="size-3.5" aria-hidden />
        Remove
      </Button>
    </form>
  );
}

export function CouponForm({
  action,
  removeAction,
  appliedCode,
  couponError,
}: {
  action: FormAction;
  removeAction: () => Promise<void>;
  appliedCode: string | null;
  couponError?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <div className="space-y-2 border-t border-line pt-4">
      {appliedCode ? (
        <div className="flex items-center justify-between rounded-[8px] border border-positive/30 bg-positive-soft px-3 py-2 text-[12.5px]">
          <span className="flex items-center gap-1.5 font-medium text-positive">
            <Tag className="size-3.5" aria-hidden />
            Code <span className="font-mono font-semibold">{appliedCode}</span> applied
          </span>
          <form action={removeAction}>
            <button
              type="submit"
              className="rounded p-0.5 text-ink-muted hover:bg-surface hover:text-ink"
              title="Remove promo code"
              aria-label="Remove promo code"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </form>
        </div>
      ) : (
        <form action={formAction} className="flex gap-2">
          <Input
            name="code"
            placeholder="Promo code"
            aria-label="Promo code"
            maxLength={32}
            className="h-9 uppercase"
            required
          />
          <Button type="submit" variant="secondary" size="sm" className="shrink-0" disabled={pending}>
            {pending ? "Applying…" : "Apply"}
          </Button>
        </form>
      )}

      {couponError ? <Alert tone="warning">{couponError}</Alert> : null}
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
    </div>
  );
}
