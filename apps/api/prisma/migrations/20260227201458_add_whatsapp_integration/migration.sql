-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "whatsapp_access_token" TEXT,
ADD COLUMN     "whatsapp_business_id" TEXT,
ADD COLUMN     "whatsapp_connected_at" TIMESTAMP(3),
ADD COLUMN     "whatsapp_phone_number" TEXT,
ADD COLUMN     "whatsapp_phone_number_id" TEXT,
ADD COLUMN     "whatsapp_verify_token" TEXT;

-- AlterTable
ALTER TABLE "delivery_notes" ADD COLUMN     "whatsapp_message_log_id" TEXT;

-- CreateTable
CREATE TABLE "whatsapp_message_logs" (
    "id" TEXT NOT NULL,
    "whatsapp_message_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sender_phone" TEXT NOT NULL,
    "sender_name" TEXT,
    "message_type" TEXT NOT NULL,
    "caption" TEXT,
    "status" "ScanStatus" NOT NULL,
    "media_count" INTEGER NOT NULL DEFAULT 1,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "reply_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_attachments" (
    "id" TEXT NOT NULL,
    "whatsapp_message_log_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT,
    "media_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "document_type" TEXT,
    "document_id" TEXT,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_message_logs_whatsapp_message_id_key" ON "whatsapp_message_logs"("whatsapp_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_message_logs_company_id_idx" ON "whatsapp_message_logs"("company_id");

-- CreateIndex
CREATE INDEX "whatsapp_message_logs_sender_phone_idx" ON "whatsapp_message_logs"("sender_phone");

-- CreateIndex
CREATE INDEX "whatsapp_attachments_whatsapp_message_log_id_idx" ON "whatsapp_attachments"("whatsapp_message_log_id");

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_whatsapp_message_log_id_fkey" FOREIGN KEY ("whatsapp_message_log_id") REFERENCES "whatsapp_message_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_attachments" ADD CONSTRAINT "whatsapp_attachments_whatsapp_message_log_id_fkey" FOREIGN KEY ("whatsapp_message_log_id") REFERENCES "whatsapp_message_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
