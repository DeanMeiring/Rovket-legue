-- AlterTable
ALTER TABLE "Performance" ADD COLUMN "replayId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Performance_replayId_userId_key" ON "Performance"("replayId", "userId");
