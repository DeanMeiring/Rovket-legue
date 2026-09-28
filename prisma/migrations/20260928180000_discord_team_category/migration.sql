-- Each team gets its own Discord category holding its text and voice channels.
ALTER TABLE "Team" ADD COLUMN "discordCategoryId" TEXT;
