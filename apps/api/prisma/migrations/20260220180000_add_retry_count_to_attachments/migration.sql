-- AlterTable
ALTER TABLE "email_scan_attachments" ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0;
