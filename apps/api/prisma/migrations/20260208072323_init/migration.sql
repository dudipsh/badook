-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ACCOUNTANT', 'FIELD_WORKER');

-- CreateEnum
CREATE TYPE "DeliveryNoteStatus" AS ENUM ('PENDING', 'PARSED', 'PARSE_FAILED', 'REVIEWED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryNoteSource" AS ENUM ('EMAIL', 'MOBILE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL', 'NO_ATTACHMENTS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ACCOUNTANT',
    "company_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "business_id" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "business_id" TEXT,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "company_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_notes" (
    "id" TEXT NOT NULL,
    "note_number" TEXT,
    "supplier_name" TEXT NOT NULL,
    "supplier_id" TEXT,
    "company_id" TEXT NOT NULL,
    "delivery_date" TIMESTAMP(3),
    "total_amount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "vat_amount" DECIMAL(12,2),
    "status" "DeliveryNoteStatus" NOT NULL DEFAULT 'PENDING',
    "source" "DeliveryNoteSource" NOT NULL,
    "original_file_url" TEXT NOT NULL,
    "original_file_name" TEXT,
    "parsed_data" JSONB,
    "parsing_confidence" DOUBLE PRECISION,
    "notes" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "created_by_id" TEXT,
    "email_scan_log_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_items" (
    "id" TEXT NOT NULL,
    "delivery_note_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "catalog_number" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT,
    "unit_price" DECIMAL(12,2),
    "total_price" DECIMAL(12,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_scan_logs" (
    "id" TEXT NOT NULL,
    "gmail_message_id" TEXT NOT NULL,
    "subject" TEXT,
    "sender_email" TEXT,
    "sender_name" TEXT,
    "received_at" TIMESTAMP(3),
    "status" "ScanStatus" NOT NULL,
    "attachment_count" INTEGER NOT NULL DEFAULT 0,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_scan_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_business_id_key" ON "companies"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_company_id_key" ON "suppliers"("name", "company_id");

-- CreateIndex
CREATE INDEX "delivery_notes_company_id_status_idx" ON "delivery_notes"("company_id", "status");

-- CreateIndex
CREATE INDEX "delivery_notes_supplier_id_idx" ON "delivery_notes"("supplier_id");

-- CreateIndex
CREATE INDEX "delivery_notes_delivery_date_idx" ON "delivery_notes"("delivery_date");

-- CreateIndex
CREATE INDEX "delivery_notes_supplier_name_idx" ON "delivery_notes"("supplier_name");

-- CreateIndex
CREATE INDEX "line_items_delivery_note_id_idx" ON "line_items"("delivery_note_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_scan_logs_gmail_message_id_key" ON "email_scan_logs"("gmail_message_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_email_scan_log_id_fkey" FOREIGN KEY ("email_scan_log_id") REFERENCES "email_scan_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_delivery_note_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
