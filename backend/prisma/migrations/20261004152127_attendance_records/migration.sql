-- CreateEnum
CREATE TYPE "GatheringType" AS ENUM ('TUESDAY_ZEMA', 'THURSDAY_CHOIR', 'SATURDAY_CHOIR');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "gathering" "GatheringType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_records_gathering_date_idx" ON "attendance_records"("gathering", "date");

-- CreateIndex
CREATE INDEX "attendance_records_memberId_idx" ON "attendance_records"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_memberId_gathering_date_key" ON "attendance_records"("memberId", "gathering", "date");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
