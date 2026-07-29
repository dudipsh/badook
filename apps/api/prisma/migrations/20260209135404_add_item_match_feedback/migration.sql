-- AlterTable
ALTER TABLE "three_way_matches" ADD COLUMN     "line_item_pairings" JSONB;

-- CreateTable
CREATE TABLE "item_match_feedback" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "description_a" TEXT NOT NULL,
    "description_b" TEXT NOT NULL,
    "catalog_number_a" TEXT,
    "catalog_number_b" TEXT,
    "source_doc_type" TEXT NOT NULL,
    "target_doc_type" TEXT NOT NULL,
    "three_way_match_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_match_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_match_feedback_company_id_idx" ON "item_match_feedback"("company_id");

-- CreateIndex
CREATE INDEX "item_match_feedback_company_id_description_a_idx" ON "item_match_feedback"("company_id", "description_a");

-- CreateIndex
CREATE INDEX "item_match_feedback_company_id_description_b_idx" ON "item_match_feedback"("company_id", "description_b");

-- AddForeignKey
ALTER TABLE "item_match_feedback" ADD CONSTRAINT "item_match_feedback_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_match_feedback" ADD CONSTRAINT "item_match_feedback_three_way_match_id_fkey" FOREIGN KEY ("three_way_match_id") REFERENCES "three_way_matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_match_feedback" ADD CONSTRAINT "item_match_feedback_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
