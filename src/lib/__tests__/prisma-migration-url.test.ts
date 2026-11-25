import { describe, expect, it } from "vitest";

import {
  normalizeSupabaseMigrationUrl,
  resolvePrismaMigrationUrl,
} from "../prisma-migration-url";

describe("resolvePrismaMigrationUrl", () => {
  it("rewrites Supabase transaction pooler port 6543 to session pooler port 5432 and drops pgbouncer", () => {
    const out = normalizeSupabaseMigrationUrl(
      "postgresql://postgres.abc:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1",
    );
    const parsed = new URL(out);
    expect(parsed.hostname).toBe("aws-0-eu-west-1.pooler.supabase.com");
    expect(parsed.port).toBe("5432");
    expect(parsed.searchParams.get("pgbouncer")).toBeNull();
    expect(parsed.searchParams.get("connection_limit")).toBe("1");
    expect(parsed.searchParams.get("sslmode")).toBe("require");
  });

  it("prefers DIRECT_URL over DATABASE_URL", () => {
    const out = resolvePrismaMigrationUrl({
      DATABASE_URL:
        "postgresql://postgres.abc:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
      DIRECT_URL: "postgresql://postgres.abc:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
    });
    expect(out).toBe(
      "postgresql://postgres.abc:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
    );
  });

  it("leaves non-Supabase URLs untouched", () => {
    const local = "postgresql://postgres:postgres@127.0.0.1:5432/kg";
    expect(resolvePrismaMigrationUrl({ DATABASE_URL: local })).toBe(local);
  });

  it("derives session pooler URL from SUPABASE_POOLER_URL and SUPABASE_DB_PASS", () => {
    const out = resolvePrismaMigrationUrl({
      SUPABASE_POOLER_URL:
        "postgresql://postgres.abc:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
      SUPABASE_DB_PASS: "my-pass",
    });
    const parsed = new URL(out!);
    expect(parsed.password).toBe("my-pass");
    expect(parsed.port).toBe("5432");
    expect(parsed.searchParams.get("pgbouncer")).toBeNull();
    expect(parsed.searchParams.get("sslmode")).toBe("require");
  });
});
