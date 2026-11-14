import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-6">
        <BrandMark />
      </Link>

      <div className="surface w-full max-w-lg p-6 shadow-sm sm:p-8">{children}</div>

      <p className="subtle mt-5 max-w-md text-center text-[12px] leading-relaxed">
        Secure sign-in powered by Supabase Auth. Your password is never stored in plain text.
      </p>
    </div>
  );
}
