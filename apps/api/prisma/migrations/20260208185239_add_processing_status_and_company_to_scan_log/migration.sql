-- CreateEnum
CREATE TYPE "OcrProvider" AS ENUM ('OPENAI', 'GEMINI');

-- AlterEnum
ALTER TYPE "ScanStatus" ADD VALUE 'PROCESSING';

-- AlterTable: add ocr_provider to companies
ALTER TABLE "companies" ADD COLUMN "ocr_provider" "OcrProvider" NOT NULL DEFAULT 'OPENAI';

-- AlterTable: add company_id as nullable first, then backfill, then make NOT NULL
ALTER TABLE "email_scan_logs" ADD COLUMN "company_id" TEXT;

-- Backfill existing rows with the first company's id
UPDATE "email_scan_logs" SET "company_id" = (SELECT id FROM "companies" LIMIT 1) WHERE "company_id" IS NULL;

-- Now make the column NOT NULL
ALTER TABLE "email_scan_logs" ALTER COLUMN "company_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "email_scan_logs_company_id_idx" ON "email_scan_logs"("company_id");
