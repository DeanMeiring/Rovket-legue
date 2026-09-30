CREATE TABLE "TeamDraft" (
    "id" TEXT NOT NULL,
    "slots" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamChatMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamChatMessage_pkey" PRIMARY KEY ("id")
);
