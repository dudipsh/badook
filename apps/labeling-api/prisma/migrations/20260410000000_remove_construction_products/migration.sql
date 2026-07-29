-- Remove seeded construction products that were polluting model training.
-- Keeps products from category "מתעודות קיימות" (extracted from real documents).
DELETE FROM "ref_products"
WHERE "category" IN (
  'איטום ובידוד',
  'אינסטלציה',
  'בטון ומלט',
  'בטיחות',
  'בלוקים ולבנים',
  'ברגים ומחברים',
  'ברזל ופלדה',
  'דלתות וחלונות',
  'חומרי בנייה כלליים',
  'חשמל',
  'כלי עבודה',
  'עץ ונגרות',
  'צבעים וחומרי גמר',
  'ריצוף וחיפוי'
);
