import { prisma } from "../db";
import { withSchemaFallback } from "../db-compat";
import {
  getCurrentSprintWeekKey,
  getFacilityDisplayName,
  getStudioLeague,
  isValidPlayerKey,
  type LeaderboardMode,
  type PublicLeaderboardEntry,
  type StudioLeaderboardSnapshot,
} from "./leaderboard-shared";

export * from "./leaderboard-shared";

type LeaderboardRow = {
  companyName: string;
  lifetimeEarnings: number;
  techTokens: bigint;
  facilityLevel: number;
  activeServers: number;
  contractsDone: number;
  holdingRegions: number;
  megaProjectsDone: number;
  weeklySprintScore: number;
  playerKey: string;
  updatedAt: Date;
};

function toPublicLeaderboardEntry(
  row: LeaderboardRow,
  rank: number,
  isMe: boolean,
): PublicLeaderboardEntry {
  return {
    rank,
    companyName: row.companyName,
    lifetimeEarnings: row.lifetimeEarnings,
    techTokens: Number(row.techTokens),
    facilityLevel: row.facilityLevel,
    facilityName: getFacilityDisplayName(row.facilityLevel),
    league: getStudioLeague(row.facilityLevel, row.lifetimeEarnings, row.holdingRegions),
    activeServers: row.activeServers,
    contractsDone: row.contractsDone,
    holdingRegions: row.holdingRegions,
    megaProjectsDone: row.megaProjectsDone,
    weeklySprintScore: row.weeklySprintScore,
    isMe,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getStudioLeaderboard(
  appSlug: string,
  playerKey?: string | null,
  limit = 50,
  mode: LeaderboardMode = "all",
): Promise<StudioLeaderboardSnapshot> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const validKey = isValidPlayerKey(playerKey) ? playerKey : null;
  const weekKey = getCurrentSprintWeekKey();
  const isWeekly = mode === "weekly";

  return withSchemaFallback(
    async () => {
      const whereClause = isWeekly
        ? { appSlug, weeklySprintKey: weekKey, weeklySprintScore: { gt: 0 } }
        : { appSlug };

      const orderBy = isWeekly
        ? [{ weeklySprintScore: "desc" as const }, { techTokens: "desc" as const }, { updatedAt: "asc" as const }]
        : [{ lifetimeEarnings: "desc" as const }, { techTokens: "desc" as const }, { updatedAt: "asc" as const }];

      const [topRows, totalPlayers, meRow] = await Promise.all([
        prisma.studioLeaderboardEntry.findMany({
          where: whereClause,
          orderBy,
          take: safeLimit,
        }),
        prisma.studioLeaderboardEntry.count({ where: whereClause }),
        validKey
          ? prisma.studioLeaderboardEntry.findUnique({
              where: { appSlug_playerKey: { appSlug, playerKey: validKey } },
            })
          : Promise.resolve(null),
      ]);

      const entries = topRows.map((row, idx) =>
        toPublicLeaderboardEntry(row, idx + 1, validKey !== null && row.playerKey === validKey),
      );

      let me: PublicLeaderboardEntry | null = entries.find((item) => item.isMe) ?? null;
      if (!me && meRow) {
        if (!isWeekly || (meRow.weeklySprintKey === weekKey && meRow.weeklySprintScore > 0)) {
          const ahead = await prisma.studioLeaderboardEntry.count({
            where: isWeekly
              ? {
                  appSlug,
                  weeklySprintKey: weekKey,
                  weeklySprintScore: { gt: meRow.weeklySprintScore },
                }
              : {
                  appSlug,
                  OR: [
                    { lifetimeEarnings: { gt: meRow.lifetimeEarnings } },
                    {
                      lifetimeEarnings: meRow.lifetimeEarnings,
                      techTokens: { gt: meRow.techTokens },
                    },
                  ],
                },
          });
          me = toPublicLeaderboardEntry(meRow, ahead + 1, true);
        }
      }

      return { appSlug, mode, weekKey, totalPlayers, entries, me };
    },
    { appSlug, mode, weekKey, totalPlayers: 0, entries: [], me: null },
  );
}
