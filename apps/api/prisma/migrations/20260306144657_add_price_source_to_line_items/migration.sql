-- DropForeignKey
ALTER TABLE "whatsapp_attachments" DROP CONSTRAINT "whatsapp_attachments_whatsapp_message_log_id_fkey";

-- AlterTable
ALTER TABLE "invoice_line_items" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "line_items" ADD COLUMN     "price_source" TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "po_line_items" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "suppliers_business_id_idx" ON "suppliers"("business_id");

-- AddForeignKey
ALTER TABLE "email_scan_logs" ADD CONSTRAINT "email_scan_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_attachments" ADD CONSTRAINT "whatsapp_attachments_whatsapp_message_log_id_fkey" FOREIGN KEY ("whatsapp_message_log_id") REFERENCES "whatsapp_message_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_item_audit_logs" ADD CONSTRAINT "line_item_audit_logs_po_line_item_id_fkey" FOREIGN KEY ("po_line_item_id") REFERENCES "po_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
