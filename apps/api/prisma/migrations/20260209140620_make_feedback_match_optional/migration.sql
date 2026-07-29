-- DropForeignKey
ALTER TABLE "item_match_feedback" DROP CONSTRAINT "item_match_feedback_three_way_match_id_fkey";

-- AlterTable
ALTER TABLE "item_match_feedback" ALTER COLUMN "three_way_match_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "item_match_feedback" ADD CONSTRAINT "item_match_feedback_three_way_match_id_fkey" FOREIGN KEY ("three_way_match_id") REFERENCES "three_way_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
