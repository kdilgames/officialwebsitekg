"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function AffiliateCodeForm({
  action,
  currentCode,
  suggestedCode,
  siteUrl,
}: {
  action: FormAction;
  currentCode: string | null;
  suggestedCode: string;
  siteUrl: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const [copied, setCopied] = useState(false);

  const shareUrl = currentCode ? `${siteUrl}/r/${currentCode}` : null;

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable.
    }
  };

  return (
    <div className="space-y-4">
      {shareUrl ? (
        <div className="rounded-lg border border-line bg-elevated p-3.5">
          <p className="subtle text-[11px] font-semibold uppercase tracking-wider">
            Your referral link
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded border border-line bg-surface px-2.5 py-1.5 font-mono text-[12.5px] text-ink">
              {shareUrl}
            </code>
            <Button type="button" size="sm" variant="secondary" onClick={copyLink}>
              {copied ? <Check className="size-3.5 text-positive" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <p className="subtle mt-2 text-[11.5px]">
            You can also link directly to any product with{" "}
            <code>{`${siteUrl}/r/${currentCode}?to=/product/<slug>`}</code> or append{" "}
            <code>{`?ref=${currentCode}`}</code> to any marketplace URL.
          </p>
        </div>
      ) : null}

      <form action={formAction} className="space-y-3">
        {state.status !== "idle" && state.message ? (
          <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
        ) : null}

        <Field
          label={currentCode ? "Update referral code" : "Choose your referral code"}
          htmlFor="affiliate-code"
          error={state.fieldErrors?.code}
          hint="3–24 uppercase letters, numbers, hyphens, or underscores."
        >
          <Input
            id="affiliate-code"
            name="code"
            required
            minLength={3}
            maxLength={24}
            defaultValue={currentCode ?? suggestedCode}
            placeholder="YOURSTUDIO"
          />
        </Field>

        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          <Link2 className="size-3.5" aria-hidden />
          {pending ? "Saving…" : currentCode ? "Save code" : "Activate affiliate link"}
        </Button>
      </form>
    </div>
  );
}
