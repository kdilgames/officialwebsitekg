"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

type AuthAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

function FormAlert({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
  );
}

export function LoginForm({
  action,
  magicLinkAction,
  next,
}: {
  action: AuthAction;
  magicLinkAction?: AuthAction;
  next?: string;
}) {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [passwordState, passwordFormAction, passwordPending] = useActionState(action, idleState);
  const [linkState, linkFormAction, linkPending] = useActionState(
    magicLinkAction ?? action,
    idleState,
  );

  return (
    <div className="space-y-4">
      {magicLinkAction ? (
        <div
          className="grid grid-cols-2 gap-1 rounded-[9px] border border-line bg-elevated p-1"
          role="tablist"
          aria-label="Sign-in method"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "password"}
            onClick={() => setMode("password")}
            className={`flex items-center justify-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              mode === "password"
                ? "bg-surface text-ink shadow-xs"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <KeyRound className="size-3.5" aria-hidden />
            Password
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "link"}
            onClick={() => setMode("link")}
            className={`flex items-center justify-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              mode === "link"
                ? "bg-surface text-ink shadow-xs"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Mail className="size-3.5" aria-hidden />
            Email link
          </button>
        </div>
      ) : null}

      {mode === "password" || !magicLinkAction ? (
        <form action={passwordFormAction} className="space-y-3.5">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <FormAlert state={passwordState} />

          <Field label="Email" htmlFor="email" error={passwordState.fieldErrors?.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@studio.com"
            />
          </Field>

          <Field label="Password" htmlFor="password" error={passwordState.fieldErrors?.password}>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <div className="flex items-center justify-between pt-1">
            <Link href="/forgot-password" className="text-[12.5px] text-ink-muted hover:text-ink">
              Forgot password?
            </Link>
            <Button type="submit" variant="primary" disabled={passwordPending}>
              {passwordPending ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </form>
      ) : (
        <form action={linkFormAction} className="space-y-3.5">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <FormAlert state={linkState} />

          <Field
            label="Email address"
            htmlFor="magic-email"
            error={linkState.fieldErrors?.email}
            hint="We send a one-click sign-in link directly to your inbox. Authorized owner and staff emails can sign in immediately."
          >
            <Input
              id="magic-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@studio.com"
            />
          </Field>

          <Button type="submit" variant="primary" className="w-full" disabled={linkPending}>
            {linkPending ? "Sending link…" : "Send sign-in link"}
          </Button>
        </form>
      )}

      <p className="muted pt-1 text-center text-[12.5px]">
        No account yet?{" "}
        <Link href="/register" className="text-accent hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm({ action }: { action: AuthAction }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3.5">
      <FormAlert state={state} />

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Username" htmlFor="username" error={state.fieldErrors?.username}>
          <Input id="username" name="username" autoComplete="username" required minLength={3} />
        </Field>
        <Field label="Display name" htmlFor="displayName" error={state.fieldErrors?.displayName}>
          <Input id="displayName" name="displayName" autoComplete="name" required />
        </Field>
      </div>

      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={state.fieldErrors?.password}
        hint="At least 10 characters with upper, lower and a number."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Field
        label="Country (optional)"
        htmlFor="country"
        error={state.fieldErrors?.country}
        hint="Two-letter ISO code, e.g. HR. Used for tax reporting on your sales."
      >
        <Input id="country" name="country" maxLength={2} placeholder="HR" />
      </Field>

      <fieldset className="space-y-2 pt-1">
        <legend className="label mb-1">Legal</legend>
        <label className="flex items-start gap-2 text-[12.5px] text-ink-muted">
          <input
            type="checkbox"
            name="acceptTerms"
            value="true"
            className="mt-0.5"
            required
            aria-invalid={state.fieldErrors?.acceptTerms ? true : undefined}
          />
          <span>
            I accept the{" "}
            <Link href="/legal/terms" className="text-accent hover:underline">
              Terms of Service
            </Link>
            .
            {state.fieldErrors?.acceptTerms ? (
              <span className="mt-1 block text-[12px] text-critical">
                {state.fieldErrors.acceptTerms}
              </span>
            ) : null}
          </span>
        </label>
        <label className="flex items-start gap-2 text-[12.5px] text-ink-muted">
          <input
            type="checkbox"
            name="acceptPrivacy"
            value="true"
            className="mt-0.5"
            required
            aria-invalid={state.fieldErrors?.acceptPrivacy ? true : undefined}
          />
          <span>
            I have read the{" "}
            <Link href="/legal/privacy" className="text-accent hover:underline">
              Privacy Policy
            </Link>
            .
            {state.fieldErrors?.acceptPrivacy ? (
              <span className="mt-1 block text-[12px] text-critical">
                {state.fieldErrors.acceptPrivacy}
              </span>
            ) : null}
          </span>
        </label>
        <label className="flex items-start gap-2 text-[12.5px] text-ink-muted">
          <input type="checkbox" name="marketingOptIn" value="true" className="mt-0.5" />
          <span>Send me occasional product and platform updates. Optional.</span>
        </label>
      </fieldset>

      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="muted text-center text-[12.5px]">
        Already registered?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm({ action }: { action: AuthAction }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3.5">
      <FormAlert state={state} />
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="muted text-center text-[12.5px]">
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ChangePasswordForm({ action }: { action: AuthAction }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3.5">
      <FormAlert state={state} />
      <Field
        label="Current password"
        htmlFor="currentPassword"
        error={state.fieldErrors?.currentPassword}
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Field
        label="New password"
        htmlFor="newPassword"
        error={state.fieldErrors?.newPassword}
        hint="At least 10 characters with upper, lower and a number."
      >
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
      </Field>
      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        error={state.fieldErrors?.confirmPassword}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

/** Used after following a password-reset link, where a session already exists. */
export function ResetPasswordForm({ action }: { action: AuthAction }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3.5">
      <FormAlert state={state} />
      <Field
        label="New password"
        htmlFor="password"
        error={state.fieldErrors?.password}
        hint="At least 10 characters with upper, lower and a number."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        error={state.fieldErrors?.confirmPassword}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
      <p className="muted text-center text-[12.5px]">
        <Link href="/account" className="text-accent hover:underline">
          Back to my account
        </Link>
      </p>
    </form>
  );
}
