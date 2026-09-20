/*
  Warnings:

  - You are about to drop the column `skillRating` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "skillRating",
ADD COLUMN     "rank1v1" INTEGER,
ADD COLUMN     "rank2v2" INTEGER,
ADD COLUMN     "rank3v3" INTEGER;
