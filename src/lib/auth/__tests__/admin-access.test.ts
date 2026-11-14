import { describe, expect, it } from "vitest";

import {
  canModifyAdminAccount,
  canSuspendAccount,
  DEFAULT_OWNER_EMAIL,
  evaluateAdminPromotion,
  isEmailAllowlistedAdmin,
  isOwnerEmail,
  normalizeEmail,
  parseAdminAllowlist,
  resolveAdminEmailSet,
  resolveOwnerEmail,
} from "../admin-access-rules";

describe("owner & allowlist email normalization", () => {
  it("uses kdilgames@gmail.com as the default owner email", () => {
    expect(DEFAULT_OWNER_EMAIL).toBe("kdilgames@gmail.com");
    expect(resolveOwnerEmail(undefined)).toBe("kdilgames@gmail.com");
    expect(resolveOwnerEmail("")).toBe("kdilgames@gmail.com");
    expect(resolveOwnerEmail("  KDILGAMES@Gmail.COM ")).toBe("kdilgames@gmail.com");
  });

  it("matches owner emails case-insensitively with whitespace trimmed", () => {
    expect(isOwnerEmail("kdilgames@gmail.com")).toBe(true);
    expect(isOwnerEmail("  KDILGAMES@GMAIL.COM  ")).toBe(true);
    expect(isOwnerEmail("other@gmail.com")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
  });

  it("parses JSON arrays, nested emails objects, and delimited strings safely", () => {
    expect(parseAdminAllowlist(["Alice@Test.com", "alice@test.com", "invalid"])).toEqual([
      "alice@test.com",
    ]);
    expect(parseAdminAllowlist("bob@example.com, CAROL@Example.com\ndave@test.org")).toEqual([
      "bob@example.com",
      "carol@example.com",
      "dave@test.org",
    ]);
    expect(parseAdminAllowlist({ emails: ["Mod@Site.com"] })).toEqual(["mod@site.com"]);
    expect(parseAdminAllowlist(null)).toEqual([]);
  });

  it("merges owner, env admins, and DB settings into a single lowercase set", () => {
    const allowed = resolveAdminEmailSet({
      ownerEmail: "KDILGAMES@gmail.com",
      envAdminEmails: ["Ops@Studio.dev"],
      settingAllowlist: ["Mod@Studio.dev"],
    });
    expect(isEmailAllowlistedAdmin("kdilgames@gmail.com", allowed)).toBe(true);
    expect(isEmailAllowlistedAdmin("ops@studio.dev", allowed)).toBe(true);
    expect(isEmailAllowlistedAdmin("mod@studio.dev", allowed)).toBe(true);
    expect(isEmailAllowlistedAdmin("buyer@example.com", allowed)).toBe(false);
  });
});

describe("evaluateAdminPromotion", () => {
  it("promotes the verified owner email automatically", () => {
    const result = evaluateAdminPromotion({
      email: "KDILGAMES@gmail.com",
      emailVerified: true,
      currentRole: "USER",
      status: "ACTIVE",
    });

    expect(result).toEqual({
      shouldPromote: true,
      reason: "owner",
      isOwner: true,
      isConfiguredAdminEmail: true,
    });
  });

  it("NEVER promotes an unverified email, even when matching the owner address", () => {
    const result = evaluateAdminPromotion({
      email: "kdilgames@gmail.com",
      emailVerified: false,
      currentRole: "USER",
      status: "ACTIVE",
    });

    expect(result.shouldPromote).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.isOwner).toBe(true);
  });

  it("does not promote suspended or deleted accounts", () => {
    const result = evaluateAdminPromotion({
      email: "kdilgames@gmail.com",
      emailVerified: true,
      currentRole: "USER",
      status: "SUSPENDED",
    });

    expect(result.shouldPromote).toBe(false);
  });

  it("promotes verified allowlisted staff emails even if they were previously SELLER", () => {
    const result = evaluateAdminPromotion({
      email: "staff@kdilgames.dev",
      emailVerified: true,
      currentRole: "SELLER",
      status: "ACTIVE",
      settingAllowlist: ["staff@kdilgames.dev"],
    });

    expect(result).toEqual({
      shouldPromote: true,
      reason: "allowlist",
      isOwner: false,
      isConfiguredAdminEmail: true,
    });
  });

  it("is a no-op when the user is already ADMIN", () => {
    const result = evaluateAdminPromotion({
      email: "kdilgames@gmail.com",
      emailVerified: true,
      currentRole: "ADMIN",
      status: "ACTIVE",
    });

    expect(result.shouldPromote).toBe(false);
  });
});

describe("owner demotion & suspension protections", () => {
  it("blocks demoting the owner email even by another admin", () => {
    const decision = canModifyAdminAccount({
      actorId: "admin-2",
      targetId: "owner-1",
      targetEmail: "KDILGAMES@gmail.com",
      targetRole: "ADMIN",
      nextRole: "USER",
      activeAdminCount: 3,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("owner");
  });

  it("blocks demoting self or last active admin", () => {
    expect(
      canModifyAdminAccount({
        actorId: "admin-2",
        targetId: "admin-2",
        targetEmail: "staff@example.com",
        targetRole: "ADMIN",
        nextRole: "USER",
        activeAdminCount: 3,
      }).allowed,
    ).toBe(false);

    expect(
      canModifyAdminAccount({
        actorId: "admin-1",
        targetId: "admin-2",
        targetEmail: "staff@example.com",
        targetRole: "ADMIN",
        nextRole: "SELLER",
        activeAdminCount: 1,
      }).allowed,
    ).toBe(false);
  });

  it("allows demoting a secondary admin when other admins remain", () => {
    expect(
      canModifyAdminAccount({
        actorId: "owner-1",
        targetId: "admin-2",
        targetEmail: "staff@example.com",
        targetRole: "ADMIN",
        nextRole: "USER",
        activeAdminCount: 2,
      }),
    ).toEqual({ allowed: true });
  });

  it("blocks suspending the owner account, self, or any administrator", () => {
    expect(
      canSuspendAccount({
        actorId: "admin-2",
        targetId: "owner-1",
        targetEmail: normalizeEmail("kdilgames@gmail.com"),
        targetRole: "USER",
      }).allowed,
    ).toBe(false);

    expect(
      canSuspendAccount({
        actorId: "owner-1",
        targetId: "owner-1",
        targetEmail: "kdilgames@gmail.com",
        targetRole: "ADMIN",
      }).allowed,
    ).toBe(false);

    expect(
      canSuspendAccount({
        actorId: "owner-1",
        targetId: "admin-2",
        targetEmail: "staff@example.com",
        targetRole: "ADMIN",
      }).allowed,
    ).toBe(false);

    expect(
      canSuspendAccount({
        actorId: "owner-1",
        targetId: "buyer-1",
        targetEmail: "buyer@example.com",
        targetRole: "USER",
      }),
    ).toEqual({ allowed: true });
  });
});
