-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "discount_amount" DECIMAL(12,2),
ADD COLUMN     "discount_percent" DECIMAL(5,2),
ADD COLUMN     "price_before_discount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "line_items" ADD COLUMN     "discount_amount" DECIMAL(12,2),
ADD COLUMN     "discount_percent" DECIMAL(5,2),
ADD COLUMN     "price_before_discount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "po_line_items" ADD COLUMN     "discount_amount" DECIMAL(12,2),
ADD COLUMN     "discount_percent" DECIMAL(5,2),
ADD COLUMN     "price_before_discount" DECIMAL(12,2);
