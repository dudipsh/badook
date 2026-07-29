-- Drop the old unique constraint that no longer exists in the schema (was @@unique([companyId, type]))
ALTER TABLE "company_integrations" DROP CONSTRAINT IF EXISTS "company_integrations_company_id_type_key";
DROP INDEX IF EXISTS "company_integrations_company_id_type_key";

-- Add the new column with a default so existing rows remain valid
ALTER TABLE "company_integrations" ADD COLUMN "slot" INTEGER NOT NULL DEFAULT 1;

-- Back-fill: for companies with multiple integrations, assign sequential slots so the new unique index can be created
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at) AS rn
  FROM "company_integrations"
)
UPDATE "company_integrations" ci
SET slot = numbered.rn
FROM numbered
WHERE ci.id = numbered.id;

-- Add the new unique constraint (matches @@unique([companyId, slot]) in schema.prisma)
CREATE UNIQUE INDEX "company_integrations_company_id_slot_key"
  ON "company_integrations"("company_id", "slot");
