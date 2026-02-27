-- CreateTable
CREATE TABLE "WebhookRoute" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inboxId" INTEGER NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookRoute_inboxId_key" ON "WebhookRoute"("inboxId");
