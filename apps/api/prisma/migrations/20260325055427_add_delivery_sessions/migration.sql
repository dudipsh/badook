-- CreateEnum
CREATE TYPE "DeliverySessionStatus" AS ENUM ('ACTIVE', 'FINALIZING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "whatsapp_message_logs" ADD COLUMN     "session_id" TEXT;

-- CreateTable
CREATE TABLE "whatsapp_delivery_sessions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sender_phone" TEXT NOT NULL,
    "sender_name" TEXT,
    "status" "DeliverySessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "text_notes" TEXT,
    "transcription" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_delivery_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_delivery_sessions_company_id_idx" ON "whatsapp_delivery_sessions"("company_id");

-- CreateIndex
CREATE INDEX "whatsapp_delivery_sessions_sender_phone_status_idx" ON "whatsapp_delivery_sessions"("sender_phone", "status");

-- CreateIndex
CREATE INDEX "whatsapp_message_logs_session_id_idx" ON "whatsapp_message_logs"("session_id");

-- AddForeignKey
ALTER TABLE "whatsapp_delivery_sessions" ADD CONSTRAINT "whatsapp_delivery_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "whatsapp_delivery_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
