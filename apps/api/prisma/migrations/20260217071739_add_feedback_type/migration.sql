-- AlterTable
ALTER TABLE "item_match_feedback" ADD COLUMN     "feedback_type" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "pairing_index" INTEGER;
