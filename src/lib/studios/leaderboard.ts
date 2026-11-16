import { prisma } from "../db";
import { withSchemaFallback } from "../db-compat";
import {
  getFacilityDisplayName,
  getStudioLeague,
  isValidPlayerKey,
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
    league: getStudioLeague(row.facilityLevel, row.lifetimeEarnings),
    activeServers: row.activeServers,
    contractsDone: row.contractsDone,
    isMe,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getStudioLeaderboard(
  appSlug: string,
  playerKey?: string | null,
  limit = 50,
): Promise<StudioLeaderboardSnapshot> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const validKey = isValidPlayerKey(playerKey) ? playerKey : null;

  return withSchemaFallback(
    async () => {
      const [topRows, totalPlayers, meRow] = await Promise.all([
        prisma.studioLeaderboardEntry.findMany({
          where: { appSlug },
          orderBy: [{ lifetimeEarnings: "desc" }, { techTokens: "desc" }, { updatedAt: "asc" }],
          take: safeLimit,
        }),
        prisma.studioLeaderboardEntry.count({ where: { appSlug } }),
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
        const ahead = await prisma.studioLeaderboardEntry.count({
          where: {
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

      return { appSlug, totalPlayers, entries, me };
    },
    { appSlug, totalPlayers: 0, entries: [], me: null },
  );
}
