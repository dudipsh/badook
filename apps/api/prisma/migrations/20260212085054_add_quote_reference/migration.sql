/*
  Warnings:

  - You are about to drop the column `delivery_note_id` on the `three_way_matches` table. All the data in the column will be lost.
  - You are about to drop the column `invoice_id` on the `three_way_matches` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "three_way_matches" DROP CONSTRAINT "three_way_matches_delivery_note_id_fkey";

-- DropForeignKey
ALTER TABLE "three_way_matches" DROP CONSTRAINT "three_way_matches_invoice_id_fkey";

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "max_upload_size_mb" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "line_items" ADD COLUMN     "delivered" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "handwritten_notes" TEXT,
ADD COLUMN     "received_quantity" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "quote_reference" TEXT;

-- AlterTable
ALTER TABLE "three_way_matches" DROP COLUMN "delivery_note_id",
DROP COLUMN "invoice_id";

-- CreateTable
CREATE TABLE "api_usage_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "estimated_cost_usd" DECIMAL(10,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DeliveryNoteToThreeWayMatch" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DeliveryNoteToThreeWayMatch_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InvoiceToThreeWayMatch" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InvoiceToThreeWayMatch_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "api_usage_logs_company_id_created_at_idx" ON "api_usage_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "_DeliveryNoteToThreeWayMatch_B_index" ON "_DeliveryNoteToThreeWayMatch"("B");

-- CreateIndex
CREATE INDEX "_InvoiceToThreeWayMatch_B_index" ON "_InvoiceToThreeWayMatch"("B");

-- AddForeignKey
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeliveryNoteToThreeWayMatch" ADD CONSTRAINT "_DeliveryNoteToThreeWayMatch_A_fkey" FOREIGN KEY ("A") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeliveryNoteToThreeWayMatch" ADD CONSTRAINT "_DeliveryNoteToThreeWayMatch_B_fkey" FOREIGN KEY ("B") REFERENCES "three_way_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InvoiceToThreeWayMatch" ADD CONSTRAINT "_InvoiceToThreeWayMatch_A_fkey" FOREIGN KEY ("A") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InvoiceToThreeWayMatch" ADD CONSTRAINT "_InvoiceToThreeWayMatch_B_fkey" FOREIGN KEY ("B") REFERENCES "three_way_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
