-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "gmail_connected_at" TIMESTAMP(3),
ADD COLUMN     "gmail_email" TEXT,
ADD COLUMN     "gmail_refresh_token" TEXT;
