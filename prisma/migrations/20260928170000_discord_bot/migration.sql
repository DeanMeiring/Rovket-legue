-- AlterTable
ALTER TABLE "User" ADD COLUMN     "discordId" TEXT,
ADD COLUMN     "discordUsername" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "discordRoleId" TEXT,
ADD COLUMN     "discordTextChannelId" TEXT,
ADD COLUMN     "discordVoiceChannelId" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "discordReminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EventDiscordMessage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,

    CONSTRAINT "EventDiscordMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventDiscordMessage_eventId_idx" ON "EventDiscordMessage"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventDiscordMessage_channelId_messageId_key" ON "EventDiscordMessage"("channelId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- AddForeignKey
ALTER TABLE "EventDiscordMessage" ADD CONSTRAINT "EventDiscordMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

