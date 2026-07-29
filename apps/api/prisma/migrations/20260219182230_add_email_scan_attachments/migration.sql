-- CreateTable
CREATE TABLE "email_scan_attachments" (
    "id" TEXT NOT NULL,
    "email_scan_log_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "document_type" TEXT,
    "document_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_scan_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_scan_attachments_email_scan_log_id_idx" ON "email_scan_attachments"("email_scan_log_id");

-- AddForeignKey
ALTER TABLE "email_scan_attachments" ADD CONSTRAINT "email_scan_attachments_email_scan_log_id_fkey" FOREIGN KEY ("email_scan_log_id") REFERENCES "email_scan_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
