-- DropTable
DROP TABLE IF EXISTS "agent_prompts";

-- DropEnum
DROP TYPE IF EXISTS "AgentType";

-- AlterTable: Add originalFileUrlHq to delivery_notes
ALTER TABLE "delivery_notes" ADD COLUMN "original_file_url_hq" TEXT;

-- AlterTable: Add originalFileUrlHq to purchase_orders
ALTER TABLE "purchase_orders" ADD COLUMN "original_file_url_hq" TEXT;

-- AlterTable: Add originalFileUrlHq to invoices
ALTER TABLE "invoices" ADD COLUMN "original_file_url_hq" TEXT;
