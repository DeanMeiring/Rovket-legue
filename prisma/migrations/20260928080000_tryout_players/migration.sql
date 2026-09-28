-- CreateTable
CREATE TABLE "TryoutPlayer" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT,
    "currentTeam" INTEGER NOT NULL DEFAULT 0,
    "rank2v2" INTEGER,
    "rank3v3" INTEGER,
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TryoutPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TryoutPlayer_userId_key" ON "TryoutPlayer"("userId");

-- AddForeignKey
ALTER TABLE "TryoutPlayer" ADD CONSTRAINT "TryoutPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
