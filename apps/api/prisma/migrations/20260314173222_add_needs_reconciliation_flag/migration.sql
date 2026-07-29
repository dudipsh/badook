-- AlterTable
ALTER TABLE "delivery_notes" ADD COLUMN     "needs_reconciliation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "needs_reconciliation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "needs_reconciliation" BOOLEAN NOT NULL DEFAULT false;
