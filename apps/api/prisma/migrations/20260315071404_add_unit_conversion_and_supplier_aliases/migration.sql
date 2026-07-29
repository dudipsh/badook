-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "catalog_item_conversions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "catalog_number" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "from_unit" TEXT NOT NULL,
    "to_unit" TEXT NOT NULL,
    "factor" DECIMAL(16,6) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'learned',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_item_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_item_conversions_company_id_idx" ON "catalog_item_conversions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_item_conversions_company_id_catalog_number_from_uni_key" ON "catalog_item_conversions"("company_id", "catalog_number", "from_unit", "to_unit");
