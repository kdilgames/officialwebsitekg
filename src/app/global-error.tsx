"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
    console.error("Unhandled global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#faf9f5] px-4 text-[#141413]">
        <div className="w-full max-w-md rounded-xl border border-black/10 bg-white p-6 text-center shadow-sm">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#2563eb]">
            Unexpected error
          </p>
          <h1 className="mt-2 text-[20px] font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[#57564f]">
            The application hit an unexpected error. Try reloading the page.
          </p>
          {error.digest ? (
            <p className="mt-3 font-mono text-[11px] text-[#73726a]">
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#141413] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            Reload page
          </button>
        </div>
      </body>
    </html>
  );
}
