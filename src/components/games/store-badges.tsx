import { safeHttpUrl } from "@/lib/utils/media";

/**
 * Renders official-style App Store and Google Play download badges.
 * Badges with no configured store URL are omitted completely (no dead links).
 */
export function StoreBadges({
  appStoreUrl,
  playStoreUrl,
  gameName,
}: {
  appStoreUrl?: string | null;
  playStoreUrl?: string | null;
  gameName: string;
}) {
  const safeAppStore = safeHttpUrl(appStoreUrl);
  const safePlayStore = safeHttpUrl(playStoreUrl);

  if (!safeAppStore && !safePlayStore) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {safePlayStore ? (
        <a
          href={safePlayStore}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Get ${gameName} on Google Play`}
          className="inline-flex items-center gap-2.5 rounded-lg border border-black/20 bg-[#141413] px-3.5 py-2 text-white shadow-xs transition-opacity hover:opacity-90"
        >
          <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3.609 1.814 13.792 12 3.61 22.186a1.75 1.75 0 0 1-.61-1.33V3.144c0-.517.224-.995.609-1.33Zm11.24 11.24 2.57 2.57-10.35 5.915 7.78-8.485Zm3.548-2.028 2.275 1.3c.77.44.77 1.548 0 1.988l-2.275 1.3-2.805-2.294 2.805-2.294ZM7.07 2.461l10.35 5.915-2.57 2.57-7.78-8.485Z" />
          </svg>
          <span className="flex flex-col text-left leading-tight">
            <span className="text-[9.5px] font-medium uppercase tracking-wider text-white/75">
              Get it on
            </span>
            <span className="text-[13.5px] font-semibold tracking-tight">Google Play</span>
          </span>
        </a>
      ) : null}

      {safeAppStore ? (
        <a
          href={safeAppStore}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Download ${gameName} on the App Store`}
          className="inline-flex items-center gap-2.5 rounded-lg border border-black/20 bg-[#141413] px-3.5 py-2 text-white shadow-xs transition-opacity hover:opacity-90"
        >
          <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83ZM15.97 6.33c.68-.83 1.14-1.98 1.01-3.13-.98.04-2.17.65-2.87 1.48-.62.72-1.17 1.89-1.02 3.01 1.09.08 2.2-.54 2.88-1.36Z" />
          </svg>
          <span className="flex flex-col text-left leading-tight">
            <span className="text-[9.5px] font-medium tracking-wide text-white/75">
              Download on the
            </span>
            <span className="text-[13.5px] font-semibold tracking-tight">App Store</span>
          </span>
        </a>
      ) : null}
    </div>
  );
}
