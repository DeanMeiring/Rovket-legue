-- CreateTable
CREATE TABLE "TryoutGame" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "blueIds" TEXT[],
    "orangeIds" TEXT[],
    "blueGoals" INTEGER,
    "orangeGoals" INTEGER,
    "ballchasingId" TEXT,
    "replayStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TryoutGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TryoutGameStat" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "win" BOOLEAN NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "shots" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "mvp" BOOLEAN NOT NULL DEFAULT false,
    "boostPerMinute" DOUBLE PRECISION,
    "avgSpeed" DOUBLE PRECISION,
    "percentBehindBall" DOUBLE PRECISION,
    "demosInflicted" INTEGER,
    "raw" JSONB,

    CONSTRAINT "TryoutGameStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TryoutEvaluation" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TryoutEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TryoutGame_number_key" ON "TryoutGame"("number");

-- CreateIndex
CREATE INDEX "TryoutGameStat_playerId_idx" ON "TryoutGameStat"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TryoutGameStat_gameId_playerId_key" ON "TryoutGameStat"("gameId", "playerId");

-- AddForeignKey
ALTER TABLE "TryoutGameStat" ADD CONSTRAINT "TryoutGameStat_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "TryoutGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TryoutGameStat" ADD CONSTRAINT "TryoutGameStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "TryoutPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

