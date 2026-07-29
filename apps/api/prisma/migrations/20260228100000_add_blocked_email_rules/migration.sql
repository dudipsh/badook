-- AlterEnum
ALTER TYPE "ScanStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "blocked_email_rules" JSONB NOT NULL DEFAULT '[]';
