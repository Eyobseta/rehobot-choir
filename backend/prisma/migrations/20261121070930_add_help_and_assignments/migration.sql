-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('PRAYER_LEADER', 'WORSHIP_LEADER');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReassignmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HelpFeedback" AS ENUM ('NONE', 'UP', 'DOWN');

-- AlterEnum
ALTER TYPE "GatheringType" ADD VALUE 'SPECIAL_EVENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SERVICE_ASSIGNMENT';
ALTER TYPE "NotificationType" ADD VALUE 'REASSIGNMENT_UPDATE';

-- CreateTable
CREATE TABLE "service_assignments" (
    "id" TEXT NOT NULL,
    "gatheringType" "GatheringType" NOT NULL,
    "customGatheringName" TEXT,
    "dateEthYear" INTEGER NOT NULL,
    "dateEthMonth" INTEGER NOT NULL,
    "dateEthDay" INTEGER NOT NULL,
    "dateGregorian" DATE NOT NULL,
    "role" "AssignmentRole" NOT NULL,
    "assignedUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reassignment_requests" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReassignmentStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reassignment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_entries" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "intentsEn" TEXT[],
    "intentsAm" TEXT[],
    "questionVariantsEn" TEXT[],
    "questionVariantsAm" TEXT[],
    "answerEn" TEXT NOT NULL,
    "answerAm" TEXT NOT NULL DEFAULT '',
    "deepLink" TEXT,
    "visibleToRoles" "UserRole"[],
    "screenHints" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_query_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "roleAtQuery" "UserRole",
    "screen" TEXT,
    "language" TEXT NOT NULL,
    "rawQuery" TEXT,
    "matchedEntryId" TEXT,
    "matchScore" DOUBLE PRECISION,
    "feedback" "HelpFeedback" NOT NULL DEFAULT 'NONE',
    "feedbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_assignments_dateGregorian_idx" ON "service_assignments"("dateGregorian");

-- CreateIndex
CREATE INDEX "service_assignments_assignedUserId_idx" ON "service_assignments"("assignedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "service_assignments_gatheringType_dateGregorian_role_key" ON "service_assignments"("gatheringType", "dateGregorian", "role");

-- CreateIndex
CREATE INDEX "reassignment_requests_assignmentId_idx" ON "reassignment_requests"("assignmentId");

-- CreateIndex
CREATE INDEX "reassignment_requests_status_idx" ON "reassignment_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "help_entries_slug_key" ON "help_entries"("slug");

-- CreateIndex
CREATE INDEX "help_entries_category_idx" ON "help_entries"("category");

-- CreateIndex
CREATE INDEX "help_entries_active_idx" ON "help_entries"("active");

-- CreateIndex
CREATE INDEX "help_query_logs_createdAt_idx" ON "help_query_logs"("createdAt");

-- CreateIndex
CREATE INDEX "help_query_logs_matchedEntryId_idx" ON "help_query_logs"("matchedEntryId");

-- CreateIndex
CREATE INDEX "help_query_logs_userId_idx" ON "help_query_logs"("userId");

-- AddForeignKey
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reassignment_requests" ADD CONSTRAINT "reassignment_requests_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "service_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reassignment_requests" ADD CONSTRAINT "reassignment_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reassignment_requests" ADD CONSTRAINT "reassignment_requests_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_query_logs" ADD CONSTRAINT "help_query_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_query_logs" ADD CONSTRAINT "help_query_logs_matchedEntryId_fkey" FOREIGN KEY ("matchedEntryId") REFERENCES "help_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
