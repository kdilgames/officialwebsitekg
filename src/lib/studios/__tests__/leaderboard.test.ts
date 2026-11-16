import { describe, expect, it } from "vitest";

import {
  formatCompactCount,
  formatCompactUsd,
  getFacilityDisplayName,
  getStudioLeague,
  isValidPlayerKey,
  leaderboardSubmissionSchema,
  sanitizeStudioName,
} from "../leaderboard-shared";

describe("ByteRack Global Leaderboard helpers", () => {
  it("sanitizes company names and rejects unsafe characters", () => {
    expect(sanitizeStudioName("  <KDIL>   Studios\n ")).toBe("KDIL Studios");
    expect(sanitizeStudioName("   ")).toBe("ByteRack Studio");
    expect(sanitizeStudioName("VeryLongHostingStudioNameBeyond24Chars")).toHaveLength(24);
  });

  it("validates playerKeys and numeric submission bounds", () => {
    expect(isValidPlayerKey("br-abc123def456")).toBe(true);
    expect(isValidPlayerKey("short")).toBe(false);
    expect(isValidPlayerKey("bad key!")).toBe(false);

    const ok = leaderboardSubmissionSchema.safeParse({
      playerKey: "byterack_1234567890abcdef",
      companyName: "KDILGAMES",
      lifetimeEarnings: 1.06e21,
      techTokens: 2970576,
      facilityLevel: 6,
      activeServers: 1919,
      contractsDone: 15,
      appVersion: "1.5.0",
    });
    expect(ok.success).toBe(true);

    const bad = leaderboardSubmissionSchema.safeParse({
      playerKey: "byterack_1234567890abcdef",
      companyName: "Hack",
      lifetimeEarnings: -10,
      techTokens: 0,
      facilityLevel: 0,
      activeServers: 0,
      contractsDone: 0,
    });
    expect(bad.success).toBe(false);
  });

  it("formats compact USD, counts, facilities, and leagues accurately", () => {
    expect(formatCompactUsd(1_250)).toBe("$1.25K");
    expect(formatCompactUsd(1.06e21)).toBe("$1.06Sx");
    expect(formatCompactCount(2_970_576)).toBe("2.97M");
    expect(getFacilityDisplayName(8)).toBe("Arctic Deep Vault");
    expect(getStudioLeague(8, 1e18)).toBe("Arctic Sovereign");
  });
});
