/*
  Warnings:

  - You are about to drop the column `deadlineDate` on the `annual_funding_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `expiryDate` on the `annual_funding_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `attendance_records` table. All the data in the column will be lost.
  - You are about to drop the column `birthdayDate` on the `birthday_posts` table. All the data in the column will be lost.
  - You are about to drop the column `dateOnly` on the `daily_quotes` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `dateOfBirth` on the `member_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `joiningDate` on the `member_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `memories` table. All the data in the column will be lost.
  - You are about to drop the column `dateOfBirth` on the `registration_applications` table. All the data in the column will be lost.
  - You are about to drop the column `joiningDate` on the `registration_applications` table. All the data in the column will be lost.
  - You are about to drop the column `deadlineDate` on the `special_donation_campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `special_donation_campaigns` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[memberId,gathering,dateGregorian]` on the table `attendance_records` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dateGregorian]` on the table `daily_quotes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[method,providerName,accountIdentifier]` on the table `payment_instructions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `deadlineGregorian` to the `annual_funding_configurations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiryGregorian` to the `annual_funding_configurations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateEthDay` to the `attendance_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateEthMonth` to the `attendance_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateEthYear` to the `attendance_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateGregorian` to the `attendance_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `birthdayEthDay` to the `birthday_posts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `birthdayEthMonth` to the `birthday_posts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `birthdayEthYear` to the `birthday_posts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `birthdayGregorian` to the `birthday_posts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateEthDay` to the `daily_quotes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateEthMonth` to the `daily_quotes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateEthYear` to the `daily_quotes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateGregorian` to the `daily_quotes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateEthDay` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateEthMonth` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateEthYear` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateGregorian` to the `events` table without a default value. This is not possible if the table is not empty.
  - Made the column `paymentMethod` on table `funding_declarations` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `dateOfBirthEthDay` to the `member_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateOfBirthEthMonth` to the `member_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateOfBirthEthYear` to the `member_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateOfBirthGregorian` to the `member_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateEthDay` to the `memories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateEthMonth` to the `memories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateEthYear` to the `memories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateGregorian` to the `memories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateOfBirthEthDay` to the `registration_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateOfBirthEthMonth` to the `registration_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateOfBirthEthYear` to the `registration_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateOfBirthGregorian` to the `registration_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deadlineGregorian` to the `special_donation_campaigns` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "attendance_records_gathering_date_idx";

-- DropIndex
DROP INDEX "attendance_records_memberId_gathering_date_key";

-- DropIndex
DROP INDEX "birthday_posts_year_idx";

-- DropIndex
DROP INDEX "daily_quotes_dateOnly_idx";

-- DropIndex
DROP INDEX "daily_quotes_dateOnly_key";

-- DropIndex
DROP INDEX "events_date_idx";

-- DropIndex
DROP INDEX "events_status_date_idx";

-- DropIndex
DROP INDEX "memories_date_idx";

-- DropIndex
DROP INDEX "memories_status_date_idx";

-- DropIndex
DROP INDEX "special_donation_campaigns_status_deadlineDate_idx";

-- AlterTable
ALTER TABLE "annual_funding_configurations" DROP COLUMN "deadlineDate",
DROP COLUMN "expiryDate",
ADD COLUMN     "deadlineGregorian" DATE NOT NULL,
ADD COLUMN     "expiryGregorian" DATE NOT NULL;

-- AlterTable
ALTER TABLE "attendance_records" DROP COLUMN "date",
ADD COLUMN     "dateEthDay" INTEGER NOT NULL,
ADD COLUMN     "dateEthMonth" INTEGER NOT NULL,
ADD COLUMN     "dateEthYear" INTEGER NOT NULL,
ADD COLUMN     "dateGregorian" DATE NOT NULL;

-- AlterTable
ALTER TABLE "birthday_posts" DROP COLUMN "birthdayDate",
ADD COLUMN     "birthdayEthDay" INTEGER NOT NULL,
ADD COLUMN     "birthdayEthMonth" INTEGER NOT NULL,
ADD COLUMN     "birthdayEthYear" INTEGER NOT NULL,
ADD COLUMN     "birthdayGregorian" DATE NOT NULL;

-- AlterTable
ALTER TABLE "daily_quotes" DROP COLUMN "dateOnly",
ADD COLUMN     "dateEthDay" INTEGER NOT NULL,
ADD COLUMN     "dateEthMonth" INTEGER NOT NULL,
ADD COLUMN     "dateEthYear" INTEGER NOT NULL,
ADD COLUMN     "dateGregorian" DATE NOT NULL;

-- AlterTable
ALTER TABLE "events" DROP COLUMN "date",
ADD COLUMN     "dateEthDay" INTEGER NOT NULL,
ADD COLUMN     "dateEthMonth" INTEGER NOT NULL,
ADD COLUMN     "dateEthYear" INTEGER NOT NULL,
ADD COLUMN     "dateGregorian" DATE NOT NULL;

-- AlterTable
ALTER TABLE "funding_declarations" ALTER COLUMN "paymentMethod" SET NOT NULL;

-- AlterTable
ALTER TABLE "member_profiles" DROP COLUMN "dateOfBirth",
DROP COLUMN "joiningDate",
ADD COLUMN     "dateOfBirthEthDay" INTEGER NOT NULL,
ADD COLUMN     "dateOfBirthEthMonth" INTEGER NOT NULL,
ADD COLUMN     "dateOfBirthEthYear" INTEGER NOT NULL,
ADD COLUMN     "dateOfBirthGregorian" DATE NOT NULL,
ADD COLUMN     "joiningDateEthDay" INTEGER,
ADD COLUMN     "joiningDateEthMonth" INTEGER,
ADD COLUMN     "joiningDateEthYear" INTEGER,
ADD COLUMN     "joiningDateGregorian" DATE;

-- AlterTable
ALTER TABLE "memories" DROP COLUMN "date",
ADD COLUMN     "dateEthDay" INTEGER NOT NULL,
ADD COLUMN     "dateEthMonth" INTEGER NOT NULL,
ADD COLUMN     "dateEthYear" INTEGER NOT NULL,
ADD COLUMN     "dateGregorian" DATE NOT NULL;

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "fundingCampaignEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fundingReminderEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "registration_applications" DROP COLUMN "dateOfBirth",
DROP COLUMN "joiningDate",
ADD COLUMN     "dateOfBirthEthDay" INTEGER NOT NULL,
ADD COLUMN     "dateOfBirthEthMonth" INTEGER NOT NULL,
ADD COLUMN     "dateOfBirthEthYear" INTEGER NOT NULL,
ADD COLUMN     "dateOfBirthGregorian" DATE NOT NULL,
ADD COLUMN     "joiningDateEthDay" INTEGER,
ADD COLUMN     "joiningDateEthMonth" INTEGER,
ADD COLUMN     "joiningDateEthYear" INTEGER,
ADD COLUMN     "joiningDateGregorian" DATE;

-- AlterTable
ALTER TABLE "special_donation_campaigns" DROP COLUMN "deadlineDate",
DROP COLUMN "startDate",
ADD COLUMN     "deadlineGregorian" DATE NOT NULL,
ADD COLUMN     "receiptUploadsEnabled" BOOLEAN,
ADD COLUMN     "referenceEnabled" BOOLEAN,
ADD COLUMN     "startGregorian" DATE;

-- CreateIndex
CREATE INDEX "attendance_records_gathering_dateGregorian_idx" ON "attendance_records"("gathering", "dateGregorian");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_memberId_gathering_dateGregorian_key" ON "attendance_records"("memberId", "gathering", "dateGregorian");

-- CreateIndex
CREATE INDEX "birthday_posts_birthdayGregorian_idx" ON "birthday_posts"("birthdayGregorian");

-- CreateIndex
CREATE INDEX "daily_quotes_dateGregorian_idx" ON "daily_quotes"("dateGregorian");

-- CreateIndex
CREATE UNIQUE INDEX "daily_quotes_dateGregorian_key" ON "daily_quotes"("dateGregorian");

-- CreateIndex
CREATE INDEX "events_status_dateGregorian_idx" ON "events"("status", "dateGregorian");

-- CreateIndex
CREATE INDEX "events_dateGregorian_idx" ON "events"("dateGregorian");

-- CreateIndex
CREATE INDEX "memories_status_dateGregorian_idx" ON "memories"("status", "dateGregorian");

-- CreateIndex
CREATE INDEX "memories_dateGregorian_idx" ON "memories"("dateGregorian");

-- CreateIndex
CREATE UNIQUE INDEX "payment_instructions_method_providerName_accountIdentifier_key" ON "payment_instructions"("method", "providerName", "accountIdentifier");

-- CreateIndex
CREATE INDEX "special_donation_campaigns_status_deadlineGregorian_idx" ON "special_donation_campaigns"("status", "deadlineGregorian");


-- Gap #4: A FundingDeclaration targets exactly one of annual or donation.
ALTER TABLE "funding_declarations"
  ADD CONSTRAINT "funding_declarations_one_target"
  CHECK (
    (("annualRecordId" IS NOT NULL)::int + ("donationPaymentId" IS NOT NULL)::int) = 1
  );

-- Gap #6: At most one PENDING declaration per target record.
CREATE UNIQUE INDEX "funding_declarations_pending_annual_uniq"
  ON "funding_declarations" ("annualRecordId")
  WHERE "status" = 'PENDING' AND "annualRecordId" IS NOT NULL;

CREATE UNIQUE INDEX "funding_declarations_pending_donation_uniq"
  ON "funding_declarations" ("donationPaymentId")
  WHERE "status" = 'PENDING' AND "donationPaymentId" IS NOT NULL;

-- Defensive: payment_instructions must never store empty identifiers.
ALTER TABLE "payment_instructions"
  ADD CONSTRAINT "payment_instructions_identifier_not_empty"
  CHECK (length(trim("accountIdentifier")) > 0);