-- KDILGAMES Software Studios — Extend Global Leaderboard with Holding Regions & Weekly Sprints

ALTER TABLE "StudioLeaderboardEntry"
    ADD COLUMN "holdingRegions" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "megaProjectsDone" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "weeklySprintKey" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "weeklySprintScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX "StudioLeaderboardEntry_appSlug_weeklySprintKey_weeklySprintScore_idx"
    ON "StudioLeaderboardEntry"("appSlug", "weeklySprintKey", "weeklySprintScore" DESC);
