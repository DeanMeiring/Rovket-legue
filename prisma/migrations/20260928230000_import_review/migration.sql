-- CreateTable
CREATE TABLE "PendingPerformance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "replayId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "shots" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "mvp" BOOLEAN NOT NULL DEFAULT false,
    "win" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAlias" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventReplay" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "replayId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventReplay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingBrief" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachingBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingPerformance_eventId_replayId_playerName_key" ON "PendingPerformance"("eventId", "replayId", "playerName");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAlias_name_key" ON "PlayerAlias"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EventReplay_eventId_replayId_key" ON "EventReplay"("eventId", "replayId");

-- CreateIndex
CREATE INDEX "PlayerReview_userId_idx" ON "PlayerReview"("userId");

-- AddForeignKey
ALTER TABLE "PendingPerformance" ADD CONSTRAINT "PendingPerformance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAlias" ADD CONSTRAINT "PlayerAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReplay" ADD CONSTRAINT "EventReplay_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerReview" ADD CONSTRAINT "PlayerReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
