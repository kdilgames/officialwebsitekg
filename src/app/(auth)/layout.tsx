import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <Link href="/" className="mb-6 rounded-[11px] p-0.5" aria-label="KDILGAMES Home">
        <BrandMark size="lg" />
      </Link>

      <div className="surface w-full max-w-lg p-6 shadow-sm sm:p-8">{children}</div>

      <p className="subtle mt-5 max-w-md text-center text-[12px] leading-relaxed">
        Secure sign-in powered by Supabase Auth. Your password is never stored in plain text.
      </p>
    </div>
  );
}
