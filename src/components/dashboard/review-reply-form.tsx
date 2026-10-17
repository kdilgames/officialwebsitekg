"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

export function ReviewReplyForm({
  action,
  reviewId,
  defaultValue,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  reviewId: string;
  defaultValue: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reviewId" value={reviewId} />

      {state.status !== "idle" && state.message ? (
        <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
      ) : null}

      <Textarea
        name="reply"
        rows={2}
        maxLength={2000}
        defaultValue={defaultValue}
        placeholder="Reply publicly as the seller…"
        required
      />

      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Saving…" : defaultValue ? "Update reply" : "Post reply"}
      </Button>
    </form>
  );
}
