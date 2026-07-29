-- DropForeignKey
ALTER TABLE "line_item_audit_logs" DROP CONSTRAINT "line_item_audit_logs_po_line_item_id_fkey";

-- AddForeignKey
ALTER TABLE "line_item_audit_logs" ADD CONSTRAINT "line_item_audit_logs_po_line_item_id_fkey" FOREIGN KEY ("po_line_item_id") REFERENCES "po_line_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
