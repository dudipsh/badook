-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DELIVERY_NOTE', 'INVOICE', 'PURCHASE_ORDER');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('PENDING', 'AUTO_EXTRACTED', 'LABELED', 'VERIFIED');

-- CreateTable
CREATE TABLE "samples" (
    "id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "status" "SampleStatus" NOT NULL DEFAULT 'PENDING',
    "original_file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "page_count" INTEGER NOT NULL DEFAULT 1,
    "gemini_extraction" JSONB,
    "gemini_confidence" DOUBLE PRECISION,
    "gemini_tokens" INTEGER,
    "gemini_cost_usd" DOUBLE PRECISION,
    "qwen_extraction" JSONB,
    "qwen_confidence" DOUBLE PRECISION,
    "ground_truth" JSONB,
    "labeled_at" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'qwen-vl',
    "document_type" "DocumentType",
    "sample_count" INTEGER NOT NULL,
    "file_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "samples_status_idx" ON "samples"("status");

-- CreateIndex
CREATE INDEX "samples_document_type_status_idx" ON "samples"("document_type", "status");
