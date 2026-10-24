/*
  Warnings:

  - A unique constraint covering the columns `[senderId,clientId]` on the table `chat_messages` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[messageId,reporterId]` on the table `message_reports` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "chat_groups" ALTER COLUMN "createdByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_createdAt_id_idx" ON "chat_messages"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_senderId_clientId_key" ON "chat_messages"("senderId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "message_reports_messageId_reporterId_key" ON "message_reports"("messageId", "reporterId");
