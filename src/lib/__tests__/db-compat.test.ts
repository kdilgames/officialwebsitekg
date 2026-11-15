import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { isMissingSchemaError, isUniqueConstraintError, withSchemaFallback } from "../db-compat";

describe("isMissingSchemaError", () => {
  it("recognises Prisma P2021 missing table errors", () => {
    const err = new Prisma.PrismaClientKnownRequestError("The table `public.ProductBundle` does not exist", {
      code: "P2021",
      clientVersion: "7.10.1",
    });
    expect(isMissingSchemaError(err)).toBe(true);
  });

  it("recognises Prisma P2022 and wrapped Postgres 42P01/42703 errors", () => {
    expect(isMissingSchemaError({ code: "P2022" })).toBe(true);
    expect(isMissingSchemaError({ cause: { code: "42P01", message: 'relation "ProductBundle" does not exist' } })).toBe(true);
    expect(isMissingSchemaError({ message: 'column Product.demoUrl does not exist' })).toBe(true);
    expect(
      isMissingSchemaError({
        meta: { driverAdapterError: { cause: { originalCode: "42703" } } },
      }),
    ).toBe(true);
  });

  it("does not mask connection errors such as ECONNREFUSED", () => {
    expect(isMissingSchemaError({ code: "ECONNREFUSED", message: "connect ECONNREFUSED" })).toBe(false);
    expect(isMissingSchemaError(new Error("Timed out"))).toBe(false);
  });
});

describe("isUniqueConstraintError", () => {
  it("recognises Prisma P2002 and wrapped PostgreSQL 23505 errors", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`email`)", {
      code: "P2002",
      clientVersion: "7.10.1",
    });
    expect(isUniqueConstraintError(err)).toBe(true);
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(true);
    expect(isUniqueConstraintError({ cause: { code: "23505" } })).toBe(true);
    expect(
      isUniqueConstraintError({
        meta: { driverAdapterError: { cause: { originalCode: "23505" } } },
      }),
    ).toBe(true);
  });

  it("returns false for unrelated errors or primitive inputs", () => {
    expect(isUniqueConstraintError({ code: "ECONNREFUSED" })).toBe(false);
    expect(isUniqueConstraintError(new Error("Other failure"))).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});

describe("withSchemaFallback", () => {
  it("returns fallback value when schema is unmigrated", async () => {
    const res = await withSchemaFallback(
      async () => {
        throw { code: "P2021" };
      },
      [],
    );
    expect(res).toEqual([]);
  });

  it("rethrows non-schema errors", async () => {
    await expect(
      withSchemaFallback(async () => {
        throw new Error("Connection refused");
      }, []),
    ).rejects.toThrow("Connection refused");
  });
});
