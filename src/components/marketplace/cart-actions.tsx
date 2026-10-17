"use client";

import { useActionState } from "react";
import { Lock, Trash2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Checkout is a server action so the amount charged is always recomputed from
 * the database. When Stripe is not configured the action returns an explicit
 * error and nothing is charged.
 */
export function CheckoutButton({ action, disabled }: { action: FormAction; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <Button type="submit" variant="primary" className="w-full" disabled={pending || disabled}>
          <Lock className="size-4" aria-hidden />
          {pending ? "Opening secure checkout…" : "Continue to secure checkout"}
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
