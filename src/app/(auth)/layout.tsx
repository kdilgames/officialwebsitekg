import Link from "next/link";
import { Boxes } from "lucide-react";

import { env } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-[8px] border border-line bg-elevated">
          <Boxes className="size-4.5 text-accent" aria-hidden />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">
          {env.marketplace.platformName}
        </span>
      </Link>

      <div className="surface w-full max-w-lg p-6 sm:p-7">{children}</div>

      <p className="subtle mt-5 max-w-md text-center text-[12px] leading-relaxed">
        Protected by server-side session checks. Passwords are hashed by Supabase Auth and never
        stored by the marketplace itself.
      </p>
    </div>
  );
}
