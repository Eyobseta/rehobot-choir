-- AlterTable
ALTER TABLE "annual_contribution_records" ADD COLUMN     "paidMinor" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "special_donation_payments" ADD COLUMN     "paidMinor" INTEGER NOT NULL DEFAULT 0;
