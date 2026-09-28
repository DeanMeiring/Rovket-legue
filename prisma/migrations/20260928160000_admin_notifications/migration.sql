-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isMainAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifySignups" BOOLEAN NOT NULL DEFAULT true;

