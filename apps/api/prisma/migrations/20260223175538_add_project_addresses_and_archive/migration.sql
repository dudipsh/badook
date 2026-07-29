-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "project_addresses" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_addresses_address_idx" ON "project_addresses"("address");

-- CreateIndex
CREATE UNIQUE INDEX "project_addresses_project_id_address_key" ON "project_addresses"("project_id", "address");

-- AddForeignKey
ALTER TABLE "project_addresses" ADD CONSTRAINT "project_addresses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
