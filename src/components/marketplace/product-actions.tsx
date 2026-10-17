"use client";

import { useActionState } from "react";
import { Heart, ShoppingCart, Star, UserPlus } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

function Message({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <Alert tone={state.status === "error" ? "error" : "success"} className="mt-2">
      {state.message}
    </Alert>
  );
}

export function AddToCartButton({
  action,
  productId,
  next,
  disabled,
  disabledReason,
}: {
  action: FormAction;
  productId: string;
  next: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="next" value={next} />
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={pending || disabled}
          title={disabled ? disabledReason : undefined}
        >
          <ShoppingCart className="size-4" aria-hidden />
          {pending ? "Adding…" : disabled ? (disabledReason ?? "Unavailable") : "Add to cart"}
        </Button>
      </form>
      <Message state={state} />
    </div>
  );
}

export function WishlistButton({
  action,
  productId,
  active,
}: {
  action: FormAction;
  productId: string;
  active: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="productId" value={productId} />
        <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
          <Heart className={active ? "size-4 fill-critical text-critical" : "size-4"} aria-hidden />
          {active ? "Saved" : "Save to wishlist"}
        </Button>
      </form>
      <Message state={state} />
    </div>
  );
}

export function FollowButton({
  action,
  sellerId,
  active,
}: {
  action: FormAction;
  sellerId: string;
  active: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="sellerId" value={sellerId} />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          <UserPlus className="size-3.5" aria-hidden />
          {active ? "Following" : "Follow"}
        </Button>
      </form>
      <Message state={state} />
    </div>
  );
}

export function ReviewForm({ action, productId, orderItemId }: { action: FormAction; productId: string; orderItemId: string }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="orderItemId" value={orderItemId} />

      <Message state={state} />

      <Field label="Rating" htmlFor="rating" error={state.fieldErrors?.rating}>
        <div className="flex items-center gap-2">
          <Star className="size-4 text-caution" aria-hidden />
          <Input
            id="rating"
            name="rating"
            type="number"
            min={1}
            max={5}
            step={1}
            defaultValue={5}
            className="w-24"
            required
          />
        </div>
      </Field>

      <Field label="Headline (optional)" htmlFor="title" error={state.fieldErrors?.title}>
        <Input id="title" name="title" maxLength={120} placeholder="Sum it up in a line" />
      </Field>

      <Field label="Your review" htmlFor="body" error={state.fieldErrors?.body}>
        <Textarea id="body" name="body" rows={4} required placeholder="What did you build with it?" />
      </Field>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Publishing…" : "Publish review"}
      </Button>
    </form>
  );
}

export function ReportForm({
  action,
  targetType,
  targetId,
}: {
  action: FormAction;
  targetType: "PRODUCT" | "USER" | "REVIEW";
  targetId: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <details className="surface-elevated p-3">
      <summary className="cursor-pointer text-[12.5px] text-ink-muted hover:text-ink">
        Report this {targetType.toLowerCase()}
      </summary>
      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />

        <Message state={state} />

        <Field label="Reason" htmlFor="reason" error={state.fieldErrors?.reason}>
          <Input
            id="reason"
            name="reason"
            maxLength={120}
            required
            placeholder="Copyright, malware, misleading listing…"
          />
        </Field>

        <Field label="Details (optional)" htmlFor="details" error={state.fieldErrors?.details}>
          <Textarea id="details" name="details" rows={3} maxLength={2000} />
        </Field>

        <Button type="submit" variant="danger" size="sm" disabled={pending}>
          {pending ? "Submitting…" : "Submit report"}
        </Button>
      </form>
    </details>
  );
}

export function SellerReplyForm({ action, reviewId }: { action: FormAction; reviewId: string }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[12px] text-ink-muted hover:text-ink">
        Reply as seller
      </summary>
      <form action={formAction} className="mt-2 space-y-2">
        <input type="hidden" name="reviewId" value={reviewId} />
        <Message state={state} />
        <Textarea name="reply" rows={3} required maxLength={2000} placeholder="Thanks for the feedback…" />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Publish reply"}
        </Button>
      </form>
    </details>
  );
}
