"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function MarketplaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled marketplace error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className="surface w-full p-6 sm:p-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-accent">
          Temporary issue
        </p>
        <h1 className="mt-2 text-[20px] font-semibold tracking-tight text-ink">
          This page could not be loaded
        </h1>
        <p className="muted mt-2 text-[13.5px] leading-relaxed">
          Something unexpected happened while loading this page. Try reloading, or continue browsing
          the marketplace.
        </p>
        {error.digest ? (
          <p className="subtle mt-3 font-mono text-[11px]">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <button type="button" onClick={reset} className="btn btn-primary btn-sm">
            <RefreshCw className="size-3.5" aria-hidden />
            Try again
          </button>
          <Link href="/browse" className="btn btn-secondary btn-sm">
            Browse products
          </Link>
          <Link href="/" className="btn btn-ghost btn-sm">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
