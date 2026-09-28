-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "rosterGames" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "rosterPool" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rosterShared" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rosterTeamSize" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "EventGame" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "blueIds" TEXT[],
    "orangeIds" TEXT[],
    "played" BOOLEAN NOT NULL DEFAULT false,
    "blueGoals" INTEGER,
    "orangeGoals" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventGame_eventId_number_key" ON "EventGame"("eventId", "number");

-- AddForeignKey
ALTER TABLE "EventGame" ADD CONSTRAINT "EventGame_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

