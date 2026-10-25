-- CreateEnum
CREATE TYPE "FundingStatus" AS ENUM ('UNPAID', 'PENDING_VERIFICATION', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeclarationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'VOID');

-- CreateEnum
CREATE TYPE "FundingRecordType" AS ENUM ('ANNUAL', 'DONATION', 'CAMPAIGN', 'CONFIGURATION', 'PAYMENT_INSTRUCTIONS');

-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('VOLUNTARY', 'REQUIRED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK', 'TELEBIRR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FUNDING_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'FUNDING_VERIFICATION_NEEDED';
ALTER TYPE "NotificationType" ADD VALUE 'FUNDING_RESULT';
ALTER TYPE "NotificationType" ADD VALUE 'FUNDING_CAMPAIGN';

-- CreateTable
CREATE TABLE "annual_funding_configurations" (
    "id" TEXT NOT NULL,
    "contributionYear" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "includeMembers" BOOLEAN NOT NULL DEFAULT true,
    "includeLeaders" BOOLEAN NOT NULL DEFAULT true,
    "expiryEthYear" INTEGER NOT NULL,
    "expiryEthMonth" INTEGER NOT NULL,
    "expiryEthDay" INTEGER NOT NULL,
    "expiryDate" DATE NOT NULL,
    "deadlineEthYear" INTEGER NOT NULL,
    "deadlineEthMonth" INTEGER NOT NULL,
    "deadlineEthDay" INTEGER NOT NULL,
    "deadlineDate" DATE NOT NULL,
    "monthlyReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "monthlyReminderEthDay" INTEGER NOT NULL DEFAULT 1,
    "preDeadlineReminderDays" INTEGER NOT NULL DEFAULT 7,
    "receiptUploadsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "referenceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annual_funding_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annual_contribution_records" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "contributionYear" INTEGER NOT NULL,
    "amountDueMinor" INTEGER NOT NULL,
    "status" "FundingStatus" NOT NULL DEFAULT 'UNPAID',
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annual_contribution_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_donation_campaigns" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "donationType" "DonationType" NOT NULL,
    "requestedAmountMinor" INTEGER,
    "targetAmountMinor" INTEGER,
    "startEthYear" INTEGER,
    "startEthMonth" INTEGER,
    "startEthDay" INTEGER,
    "startDate" DATE,
    "deadlineEthYear" INTEGER NOT NULL,
    "deadlineEthMonth" INTEGER NOT NULL,
    "deadlineEthDay" INTEGER NOT NULL,
    "deadlineDate" DATE NOT NULL,
    "imageUrl" TEXT,
    "imagePublicId" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "special_donation_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_donation_payments" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "FundingStatus" NOT NULL DEFAULT 'UNPAID',
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_donation_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_declarations" (
    "id" TEXT NOT NULL,
    "annualRecordId" TEXT,
    "donationPaymentId" TEXT,
    "participantId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "reference" TEXT,
    "receiptUrl" TEXT,
    "receiptPublicId" TEXT,
    "clientId" TEXT,
    "status" "DeclarationStatus" NOT NULL DEFAULT 'PENDING',
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funding_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "recordType" "FundingRecordType" NOT NULL,
    "recordId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funding_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_instructions" (
    "id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "providerName" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "accountIdentifier" TEXT NOT NULL,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_reminder_logs" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recordType" "FundingRecordType" NOT NULL,
    "recordId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funding_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "annual_funding_configurations_contributionYear_key" ON "annual_funding_configurations"("contributionYear");

-- CreateIndex
CREATE INDEX "annual_contribution_records_contributionYear_status_idx" ON "annual_contribution_records"("contributionYear", "status");

-- CreateIndex
CREATE INDEX "annual_contribution_records_configId_idx" ON "annual_contribution_records"("configId");

-- CreateIndex
CREATE UNIQUE INDEX "annual_contribution_records_participantId_contributionYear_key" ON "annual_contribution_records"("participantId", "contributionYear");

-- CreateIndex
CREATE INDEX "special_donation_campaigns_status_deadlineDate_idx" ON "special_donation_campaigns"("status", "deadlineDate");

-- CreateIndex
CREATE INDEX "special_donation_payments_campaignId_status_idx" ON "special_donation_payments"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "special_donation_payments_campaignId_participantId_key" ON "special_donation_payments"("campaignId", "participantId");

-- CreateIndex
CREATE INDEX "funding_declarations_annualRecordId_declaredAt_idx" ON "funding_declarations"("annualRecordId", "declaredAt");

-- CreateIndex
CREATE INDEX "funding_declarations_donationPaymentId_declaredAt_idx" ON "funding_declarations"("donationPaymentId", "declaredAt");

-- CreateIndex
CREATE INDEX "funding_declarations_status_declaredAt_idx" ON "funding_declarations"("status", "declaredAt");

-- CreateIndex
CREATE UNIQUE INDEX "funding_declarations_participantId_clientId_key" ON "funding_declarations"("participantId", "clientId");

-- CreateIndex
CREATE INDEX "funding_audit_logs_recordType_recordId_idx" ON "funding_audit_logs"("recordType", "recordId");

-- CreateIndex
CREATE INDEX "funding_audit_logs_actorId_idx" ON "funding_audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "funding_audit_logs_createdAt_idx" ON "funding_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "payment_instructions_active_idx" ON "payment_instructions"("active");

-- CreateIndex
CREATE UNIQUE INDEX "funding_reminder_logs_recipientId_recordType_recordId_kind__key" ON "funding_reminder_logs"("recipientId", "recordType", "recordId", "kind", "periodKey");

-- AddForeignKey
ALTER TABLE "annual_funding_configurations" ADD CONSTRAINT "annual_funding_configurations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_funding_configurations" ADD CONSTRAINT "annual_funding_configurations_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_contribution_records" ADD CONSTRAINT "annual_contribution_records_configId_fkey" FOREIGN KEY ("configId") REFERENCES "annual_funding_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_contribution_records" ADD CONSTRAINT "annual_contribution_records_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_donation_campaigns" ADD CONSTRAINT "special_donation_campaigns_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_donation_payments" ADD CONSTRAINT "special_donation_payments_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "special_donation_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_donation_payments" ADD CONSTRAINT "special_donation_payments_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_declarations" ADD CONSTRAINT "funding_declarations_annualRecordId_fkey" FOREIGN KEY ("annualRecordId") REFERENCES "annual_contribution_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_declarations" ADD CONSTRAINT "funding_declarations_donationPaymentId_fkey" FOREIGN KEY ("donationPaymentId") REFERENCES "special_donation_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_declarations" ADD CONSTRAINT "funding_declarations_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_declarations" ADD CONSTRAINT "funding_declarations_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_audit_logs" ADD CONSTRAINT "funding_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_instructions" ADD CONSTRAINT "payment_instructions_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
