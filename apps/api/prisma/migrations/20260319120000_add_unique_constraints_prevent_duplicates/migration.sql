-- Clean up existing duplicates before adding unique constraints.
-- For each duplicate group, keep the most recent record and delete the rest.

-- Step 1: Disconnect duplicate POs from ThreeWayMatch (null out FK)
UPDATE "three_way_matches"
SET "purchase_order_id" = NULL
WHERE "purchase_order_id" IN (
  SELECT a.id FROM "purchase_orders" a
  JOIN "purchase_orders" b
    ON a.po_number = b.po_number
   AND a.company_id = b.company_id
   AND a.created_at < b.created_at
);

-- Step 2: Clean implicit many-to-many join tables for duplicate DNs
DELETE FROM "_DeliveryNoteToThreeWayMatch"
WHERE "A" IN (
  SELECT a.id FROM "delivery_notes" a
  JOIN "delivery_notes" b
    ON a.note_number IS NOT NULL
   AND a.note_number = b.note_number
   AND a.company_id = b.company_id
   AND a.created_at < b.created_at
);

-- Step 3: Clean implicit many-to-many join tables for duplicate Invoices
DELETE FROM "_InvoiceToThreeWayMatch"
WHERE "A" IN (
  SELECT a.id FROM "invoices" a
  JOIN "invoices" b
    ON a.invoice_number = b.invoice_number
   AND a.company_id = b.company_id
   AND a.created_at < b.created_at
);

-- Step 4: Delete duplicate POs (keep most recent)
DELETE FROM "purchase_orders" a
USING "purchase_orders" b
WHERE a.po_number = b.po_number
  AND a.company_id = b.company_id
  AND a.created_at < b.created_at;

-- Step 5: Delete duplicate Invoices (keep most recent)
DELETE FROM "invoices" a
USING "invoices" b
WHERE a.invoice_number = b.invoice_number
  AND a.company_id = b.company_id
  AND a.created_at < b.created_at;

-- Step 6: Delete duplicate DeliveryNotes (keep most recent, only where note_number is NOT NULL)
DELETE FROM "delivery_notes" a
USING "delivery_notes" b
WHERE a.note_number IS NOT NULL
  AND a.note_number = b.note_number
  AND a.company_id = b.company_id
  AND a.created_at < b.created_at;

-- Step 7: Drop old non-unique indexes replaced by unique constraints
DROP INDEX IF EXISTS "purchase_orders_po_number_idx";
DROP INDEX IF EXISTS "invoices_invoice_number_idx";

-- Step 8: Add unique constraints
CREATE UNIQUE INDEX "purchase_orders_po_number_company_id_key" ON "purchase_orders"("po_number", "company_id");
CREATE UNIQUE INDEX "invoices_invoice_number_company_id_key" ON "invoices"("invoice_number", "company_id");
CREATE UNIQUE INDEX "delivery_notes_note_number_company_id_key" ON "delivery_notes"("note_number", "company_id");
