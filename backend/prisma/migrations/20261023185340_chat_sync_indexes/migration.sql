-- CreateIndex
CREATE INDEX "chat_messages_conversationId_editedAt_idx" ON "chat_messages"("conversationId", "editedAt");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_deletedAt_idx" ON "chat_messages"("conversationId", "deletedAt");

-- CreateIndex
CREATE INDEX "message_reactions_createdAt_idx" ON "message_reactions"("createdAt");
