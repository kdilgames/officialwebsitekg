import { describe, expect, it } from "vitest";

import { resolveDatabaseUrlFromEnv } from "../env";

describe("resolveDatabaseUrlFromEnv", () => {
  it("returns explicit DATABASE_URL unchanged when it does not contain placeholder", () => {
    expect(
      resolveDatabaseUrlFromEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
      }),
    ).toBe("postgresql://user:pass@localhost:5432/app");
  });

  it("injects SUPABASE_DB_PASS into placeholder pooler URLs with libpq SSL parameters", () => {
    const resolved = resolveDatabaseUrlFromEnv({
      SUPABASE_POOLER_URL: "postgresql://postgres.ref:[YOUR-PASSWORD]@pooler.supabase.com:5432/postgres",
      SUPABASE_DB_PASS: "s3cret!",
    });
    expect(resolved).toBe(
      "postgresql://postgres.ref:s3cret!@pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true",
    );
  });

  it("returns undefined instead of throwing when SUPABASE_POOLER_URL is malformed", () => {
    expect(
      resolveDatabaseUrlFromEnv({
        SUPABASE_POOLER_URL: "not a valid url :::",
      }),
    ).toBeUndefined();
  });
});
