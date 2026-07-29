-- AlterTable: make poLineItemId optional
ALTER TABLE "line_item_audit_logs" ALTER COLUMN "po_line_item_id" DROP NOT NULL;

-- AddColumn: add dnLineItemId
ALTER TABLE "line_item_audit_logs" ADD COLUMN "dn_line_item_id" TEXT;

-- AddForeignKey
ALTER TABLE "line_item_audit_logs" ADD CONSTRAINT "line_item_audit_logs_dn_line_item_id_fkey" FOREIGN KEY ("dn_line_item_id") REFERENCES "line_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "line_item_audit_logs_dn_line_item_id_idx" ON "line_item_audit_logs"("dn_line_item_id");
