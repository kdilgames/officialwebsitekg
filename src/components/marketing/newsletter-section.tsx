"use client";

import { useActionState } from "react";
import { Mail, Sparkles } from "lucide-react";

import { TurnstileWidget } from "@/components/forms/turnstile-widget";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";
import { getDictionary } from "@/lib/i18n/dictionaries";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function NewsletterSection({
  action,
  source = "homepage",
  locale = "en",
}: {
  action: FormAction;
  source?: string;
  locale?: "en" | "hr";
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const dict = getDictionary(locale).newsletter;

  return (
    <section
      className="surface mt-12 overflow-hidden p-6 sm:p-8"
      aria-labelledby="newsletter-heading"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-accent">
            <Sparkles className="size-3.5" aria-hidden />
            {dict.eyebrow}
          </p>
          <h2 id="newsletter-heading" className="mt-1 text-[20px] font-semibold tracking-tight text-ink">
            {dict.heading}
          </h2>
          <p className="muted mt-1.5 max-w-xl text-[13.5px] leading-relaxed">{dict.subtitle}</p>
        </div>

        <form action={formAction} className="space-y-2.5">
          <input type="hidden" name="source" value={source} />
          <input type="hidden" name="locale" value={locale} />

          {state.status !== "idle" && state.message ? (
            <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={dict.placeholder}
              aria-label="Email address"
              className="flex-1"
            />
            <Button type="submit" variant="primary" disabled={pending}>
              <Mail className="size-4" aria-hidden />
              {pending ? dict.submitting : dict.submit}
            </Button>
          </div>
          <TurnstileWidget action="newsletter" />
          <p className="subtle text-[11.5px]">{dict.consentNote}</p>
        </form>
      </div>
    </section>
  );
}
