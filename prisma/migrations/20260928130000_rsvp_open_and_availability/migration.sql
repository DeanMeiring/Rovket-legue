-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "rsvpOpen" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PlayerAvailability" (
    "userId" TEXT NOT NULL,
    "slots" TEXT[],
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerAvailability_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "PlayerAvailability" ADD CONSTRAINT "PlayerAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tournaments stay closed to RSVPs until the teams are confirmed.
UPDATE "Event" SET "rsvpOpen" = false WHERE "type" = 'TOURNAMENT';
