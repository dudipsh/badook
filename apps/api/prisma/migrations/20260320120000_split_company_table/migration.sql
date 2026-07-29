-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('GMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "max_upload_size_mb" INTEGER NOT NULL DEFAULT 20,
    "default_vat_rate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_scan_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "ocr_provider" "OcrProvider" NOT NULL DEFAULT 'GEMINI',
    "scan_days_back" INTEGER NOT NULL DEFAULT 7,
    "scan_sent" BOOLEAN NOT NULL DEFAULT true,
    "blocked_email_rules" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_scan_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_integrations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "external_id" TEXT,
    "credentials" JSONB,
    "config" JSONB,
    "connected_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_company_id_key" ON "company_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_scan_settings_company_id_key" ON "company_scan_settings"("company_id");

-- CreateIndex
CREATE INDEX "company_integrations_type_external_id_idx" ON "company_integrations"("type", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_integrations_company_id_type_key" ON "company_integrations"("company_id", "type");

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_scan_settings" ADD CONSTRAINT "company_scan_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_integrations" ADD CONSTRAINT "company_integrations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn (new fields on companies)
ALTER TABLE "companies" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE';

-- ============================================================
-- DATA MIGRATION: Copy data from companies to new tables
-- ============================================================

-- 1. Populate company_settings for every existing company
-- Note: default_vat_rate did not exist in DB yet, using default 18
INSERT INTO "company_settings" ("id", "company_id", "max_upload_size_mb", "default_vat_rate", "created_at", "updated_at")
SELECT gen_random_uuid()::text, id, "max_upload_size_mb", 18, "created_at", "updated_at"
FROM "companies";

-- 2. Populate company_scan_settings for every existing company
INSERT INTO "company_scan_settings" ("id", "company_id", "ocr_provider", "scan_days_back", "scan_sent", "blocked_email_rules", "created_at", "updated_at")
SELECT gen_random_uuid()::text, id, "ocr_provider", "scan_days_back", "scan_sent", "blocked_email_rules", "created_at", "updated_at"
FROM "companies";

-- 3. Migrate Gmail integrations (only companies that have Gmail data)
INSERT INTO "company_integrations" ("id", "company_id", "type", "status", "external_id", "credentials", "config", "connected_at", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  id,
  'GMAIL'::"IntegrationType",
  CASE WHEN "gmail_refresh_token" IS NOT NULL THEN 'CONNECTED'::"IntegrationStatus" ELSE 'DISCONNECTED'::"IntegrationStatus" END,
  "gmail_email",
  CASE WHEN "gmail_refresh_token" IS NOT NULL THEN jsonb_build_object('refreshToken', "gmail_refresh_token") ELSE NULL END,
  CASE WHEN "gmail_email" IS NOT NULL THEN jsonb_build_object('email', "gmail_email") ELSE NULL END,
  "gmail_connected_at",
  "created_at",
  "updated_at"
FROM "companies"
WHERE "gmail_email" IS NOT NULL OR "gmail_refresh_token" IS NOT NULL;

-- 4. Migrate WhatsApp integrations (only companies that have WhatsApp data)
INSERT INTO "company_integrations" ("id", "company_id", "type", "status", "external_id", "credentials", "config", "connected_at", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  id,
  'WHATSAPP'::"IntegrationType",
  CASE WHEN "whatsapp_access_token" IS NOT NULL AND "whatsapp_phone_number_id" IS NOT NULL THEN 'CONNECTED'::"IntegrationStatus" ELSE 'DISCONNECTED'::"IntegrationStatus" END,
  "whatsapp_phone_number_id",
  CASE WHEN "whatsapp_access_token" IS NOT NULL THEN jsonb_build_object('accessToken', "whatsapp_access_token", 'verifyToken', "whatsapp_verify_token") ELSE NULL END,
  jsonb_build_object('phoneNumberId', "whatsapp_phone_number_id", 'businessId', "whatsapp_business_id", 'phoneNumber', "whatsapp_phone_number"),
  "whatsapp_connected_at",
  "created_at",
  "updated_at"
FROM "companies"
WHERE "whatsapp_phone_number_id" IS NOT NULL OR "whatsapp_access_token" IS NOT NULL;

-- ============================================================
-- DROP old columns from companies (data is now in new tables)
-- ============================================================
ALTER TABLE "companies" DROP COLUMN "blocked_email_rules";
ALTER TABLE "companies" DROP COLUMN "gmail_connected_at";
ALTER TABLE "companies" DROP COLUMN "gmail_email";
ALTER TABLE "companies" DROP COLUMN "gmail_refresh_token";
ALTER TABLE "companies" DROP COLUMN "max_upload_size_mb";
ALTER TABLE "companies" DROP COLUMN "ocr_provider";
ALTER TABLE "companies" DROP COLUMN "scan_days_back";
ALTER TABLE "companies" DROP COLUMN "scan_sent";
ALTER TABLE "companies" DROP COLUMN "whatsapp_access_token";
ALTER TABLE "companies" DROP COLUMN "whatsapp_business_id";
ALTER TABLE "companies" DROP COLUMN "whatsapp_connected_at";
ALTER TABLE "companies" DROP COLUMN "whatsapp_phone_number";
ALTER TABLE "companies" DROP COLUMN "whatsapp_phone_number_id";
ALTER TABLE "companies" DROP COLUMN "whatsapp_verify_token";
