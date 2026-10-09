-- CreateEnum
CREATE TYPE "DailyQuoteStatus" AS ENUM ('PUBLISHED', 'DELETED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DAILY_QUOTE';

-- CreateTable
CREATE TABLE "daily_quotes" (
    "id" TEXT NOT NULL,
    "dateOnly" DATE NOT NULL,
    "quoteText" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "youtubeUrl" TEXT,
    "audioUrl" TEXT,
    "audioPublicId" TEXT,
    "status" "DailyQuoteStatus" NOT NULL DEFAULT 'PUBLISHED',
    "submittedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_quotes_dateOnly_idx" ON "daily_quotes"("dateOnly");

-- CreateIndex
CREATE UNIQUE INDEX "daily_quotes_dateOnly_key" ON "daily_quotes"("dateOnly");

-- AddForeignKey
ALTER TABLE "daily_quotes" ADD CONSTRAINT "daily_quotes_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
