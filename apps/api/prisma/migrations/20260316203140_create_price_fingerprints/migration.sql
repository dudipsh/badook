-- AlterEnum
ALTER TYPE "LineItemEditReason" ADD VALUE 'SWAP_CORRECTION';

-- CreateTable
CREATE TABLE "price_fingerprints" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "catalog_number" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT '',
    "unit_price" DECIMAL(12,2) NOT NULL,
    "min_price" DECIMAL(12,2) NOT NULL,
    "max_price" DECIMAL(12,2) NOT NULL,
    "observation_count" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'invoice',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_fingerprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_fingerprints_company_id_idx" ON "price_fingerprints"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_fingerprints_company_id_catalog_number_unit_key" ON "price_fingerprints"("company_id", "catalog_number", "unit");
