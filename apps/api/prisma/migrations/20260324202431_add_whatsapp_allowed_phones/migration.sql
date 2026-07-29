-- CreateTable
CREATE TABLE "whatsapp_allowed_phones" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "contact_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_allowed_phones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_allowed_phones_company_id_idx" ON "whatsapp_allowed_phones"("company_id");

-- CreateIndex
CREATE INDEX "whatsapp_allowed_phones_phone_number_is_active_idx" ON "whatsapp_allowed_phones"("phone_number", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_allowed_phones_phone_number_key" ON "whatsapp_allowed_phones"("phone_number");

-- AddForeignKey
ALTER TABLE "whatsapp_allowed_phones" ADD CONSTRAINT "whatsapp_allowed_phones_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
