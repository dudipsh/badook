-- CreateEnum
CREATE TYPE "LineItemEditReason" AS ENUM ('DATA_EXTRACTION_ERROR', 'PRICE_CORRECTION', 'QUANTITY_ADJUSTMENT', 'UNIT_TYPE_CORRECTION', 'CREDIT_NOTE_APPLIED', 'OTHER');

-- CreateTable
CREATE TABLE "line_item_audit_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "po_line_item_id" TEXT NOT NULL,
    "invoice_line_item_id" TEXT,
    "match_id" TEXT,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT NOT NULL,
    "reason" "LineItemEditReason" NOT NULL,
    "note" TEXT,
    "edited_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_item_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "line_item_audit_logs_po_line_item_id_idx" ON "line_item_audit_logs"("po_line_item_id");

-- CreateIndex
CREATE INDEX "line_item_audit_logs_company_id_created_at_idx" ON "line_item_audit_logs"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "line_item_audit_logs" ADD CONSTRAINT "line_item_audit_logs_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
