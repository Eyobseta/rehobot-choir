-- CreateEnum
CREATE TYPE "SongStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'RETURNED', 'UNPUBLISHED', 'DELETED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'RETURNED');

-- CreateTable
CREATE TABLE "song_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "song_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "songs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lyrics" TEXT,
    "audioUrl" TEXT,
    "audioPublicId" TEXT,
    "youtubeUrl" TEXT,
    "categoryId" TEXT,
    "status" "SongStatus" NOT NULL DEFAULT 'DRAFT',
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "song_favorites" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "song_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zema_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "zema_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "song_submissions" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "returnReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "song_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "song_categories_name_key" ON "song_categories"("name");

-- CreateIndex
CREATE INDEX "songs_status_dateAdded_idx" ON "songs"("status", "dateAdded");

-- CreateIndex
CREATE INDEX "songs_categoryId_idx" ON "songs"("categoryId");

-- CreateIndex
CREATE INDEX "song_favorites_userId_idx" ON "song_favorites"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "song_favorites_songId_userId_key" ON "song_favorites"("songId", "userId");

-- CreateIndex
CREATE INDEX "zema_memberships_userId_idx" ON "zema_memberships"("userId");

-- CreateIndex
CREATE INDEX "zema_memberships_userId_removedAt_idx" ON "zema_memberships"("userId", "removedAt");

-- CreateIndex
CREATE INDEX "song_submissions_status_idx" ON "song_submissions"("status");

-- CreateIndex
CREATE INDEX "song_submissions_submittedByUserId_idx" ON "song_submissions"("submittedByUserId");

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "song_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_favorites" ADD CONSTRAINT "song_favorites_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_favorites" ADD CONSTRAINT "song_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zema_memberships" ADD CONSTRAINT "zema_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zema_memberships" ADD CONSTRAINT "zema_memberships_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_submissions" ADD CONSTRAINT "song_submissions_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_submissions" ADD CONSTRAINT "song_submissions_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
