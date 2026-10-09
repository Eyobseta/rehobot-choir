-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "MemoryMediaType" AS ENUM ('PHOTO', 'AUDIO', 'YOUTUBE');

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "MemoryStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "rejectionReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "submittedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_media" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "type" "MemoryMediaType" NOT NULL,
    "storageUrl" TEXT,
    "storagePublicId" TEXT,
    "youtubeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memories_status_date_idx" ON "memories"("status", "date");

-- CreateIndex
CREATE INDEX "memories_date_idx" ON "memories"("date");

-- CreateIndex
CREATE INDEX "memories_status_publishedAt_idx" ON "memories"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "memory_media_memoryId_idx" ON "memory_media"("memoryId");

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_media" ADD CONSTRAINT "memory_media_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
