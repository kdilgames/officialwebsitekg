import { env } from "@/lib/env";

export function BrandMark({ showName = true }: { showName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-accent text-white shadow-xs"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-[18px]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6.5 5.5V18.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M17 6L10 12L17 18"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showName ? (
        <span className="text-[15px] font-bold tracking-[-0.02em] text-ink">
          {env.marketplace.platformName}
        </span>
      ) : null}
    </span>
  );
}
