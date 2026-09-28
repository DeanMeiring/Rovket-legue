-- AlterTable
ALTER TABLE "TryoutPlayer" ADD COLUMN     "claimToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TryoutPlayer_claimToken_key" ON "TryoutPlayer"("claimToken");

