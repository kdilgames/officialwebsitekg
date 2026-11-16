-- KDILGAMES Software Studios — Global Leaderboard entries

CREATE TABLE "StudioLeaderboardEntry" (
    "id" UUID NOT NULL,
    "appSlug" TEXT NOT NULL,
    "playerKey" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "lifetimeEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "techTokens" BIGINT NOT NULL DEFAULT 0,
    "facilityLevel" INTEGER NOT NULL DEFAULT 0,
    "activeServers" INTEGER NOT NULL DEFAULT 0,
    "contractsDone" INTEGER NOT NULL DEFAULT 0,
    "appVersion" TEXT NOT NULL DEFAULT '1.5.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioLeaderboardEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudioLeaderboardEntry_appSlug_playerKey_key"
    ON "StudioLeaderboardEntry"("appSlug", "playerKey");

CREATE INDEX "StudioLeaderboardEntry_appSlug_lifetimeEarnings_techTokens_idx"
    ON "StudioLeaderboardEntry"("appSlug", "lifetimeEarnings" DESC, "techTokens" DESC);

ALTER TABLE public."StudioLeaderboardEntry" ENABLE ROW LEVEL SECURITY;
