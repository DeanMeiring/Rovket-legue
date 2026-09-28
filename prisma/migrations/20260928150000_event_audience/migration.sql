-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "forEveryone" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "_EventAudience" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_EventAudience_AB_unique" ON "_EventAudience"("A", "B");

-- CreateIndex
CREATE INDEX "_EventAudience_B_index" ON "_EventAudience"("B");

-- AddForeignKey
ALTER TABLE "_EventAudience" ADD CONSTRAINT "_EventAudience_A_fkey" FOREIGN KEY ("A") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventAudience" ADD CONSTRAINT "_EventAudience_B_fkey" FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

