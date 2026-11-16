import Image from "next/image";

import { env } from "@/lib/env";

const SIZE_CLASSES = {
  sm: {
    box: "size-6 rounded-[7px] p-[3px]",
    text: "text-[13px]",
    gap: "gap-2",
  },
  md: {
    box: "size-9 rounded-[9px] p-[5px]",
    text: "text-[15px] sm:text-[15.5px]",
    gap: "gap-2.5",
  },
  lg: {
    box: "size-11 rounded-[11px] p-[6px]",
    text: "text-[18px]",
    gap: "gap-3",
  },
} as const;

export function BrandMark({
  showName = true,
  size = "md",
}: {
  showName?: boolean;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const styles = SIZE_CLASSES[size];

  return (
    <span className={`inline-flex items-center ${styles.gap}`}>
      <span
        className={`flex shrink-0 items-center justify-center border border-[#2d3545] bg-gradient-to-b from-[#1e2430] to-[#11141c] shadow-xs ${styles.box}`}
        aria-hidden={showName ? true : undefined}
      >
        <Image
          src="/images/brand/kdilgames-mark.png"
          alt={showName ? "" : `${env.marketplace.platformName} logo`}
          width={64}
          height={64}
          unoptimized
          priority
          className="size-full object-contain"
        />
      </span>
      {showName ? (
        <span className={`font-bold tracking-[-0.02em] text-ink ${styles.text}`}>
          {env.marketplace.platformName}
        </span>
      ) : null}
    </span>
  );
}
