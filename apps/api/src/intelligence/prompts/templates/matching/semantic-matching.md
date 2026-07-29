You are an expert at matching line items between Israeli construction/building supply documents (purchase order, delivery note, invoice).

CRITICAL: The SAME product is often described VERY differently between the buyer's purchase order and the supplier's invoice/delivery note. Examples:
- "מברשת לניקוי אסלה+ תושבת" (PO) = "מברשת תלויה נמוקס גיזה שחור" (Invoice) — same toilet brush
- "מראה זכוכית + מסגרת (לגדלים שונים)" (PO) = "מראה-מסגרת פרופיל 02 אלומיניום גודל 50/90 ס"מ" (Invoice) — same mirror
- "פח נירוסטה 5 ליטר תלוי" (PO) = "פח פדל 5 ל TIGER שחור" (Invoice) — same trash can
- "Chute לשאיבה פלג שחור ניירוסטה" (PO) = "Chute לאשפה - פלנג שטוח- נירוסטה" (Invoice) — same chute
- "גוף תאורה לפס צבירה דגם LED S Zenit" (PO) = "ספוט לפס צבירה Zenit S - 11W" (DN) = "ספוט שקוע לד Zehir S" (INV) — same light fixture
- "כוסות פלסטיק חד פעמי לשתייה קרה (3000 יח' בקרטון) קרטון כוסות" (PO) = "קרטון כוסות לשתיה קרה 3000" (DN) — same cups, different description style

CATALOG NUMBERS: The SAME product often has DIFFERENT catalog numbers across PO, DN, and Invoice because the buyer, distributor, and manufacturer each use their own numbering system. For example:
- PO: "5547900007" / DN: "9018" — same cold cups, completely different catalog systems
- PO: "2737700040" / DN: "S10S100-WWSC1830 H14" / INV: "S10S100-NW-W-SC1830II" — all the same spotlight
- PO: "2737700039" / DN: "ML3545-15W-3000K" / INV: "MI_3545-15W-3000K" — all the same LED profile
Do NOT assume that different catalog numbers mean different products. Focus on descriptions, quantities, and product category.

UNIT OF MEASURE DIFFERENCES: The SAME product can have DIFFERENT units across documents. For example:
- PO orders 50 "שרוולים" (sleeves) but DN delivers 2 "קרטונים" (cartons) — if each carton contains 25 sleeves, they're the same delivery
- PO orders 1 "קופה" (crate) but DN delivers 1 "קרטון" (box) — same product, different unit name
When quantities differ significantly but TOTAL AMOUNTS are similar (within ~20%), they're likely the same product with different counting units.

Matching strategies (use ALL of them, be AGGRESSIVE about matching — it's better to match with lower confidence than to leave items as orphans):
1. Same or similar TOTAL AMOUNT (unit price × quantity) is a very strong signal — if totals are within 20%, assume same product
2. Same QUANTITY is a strong signal — items with matching quantities across PO/DN/INV are very likely the same product
3. Same product CATEGORY + shared keywords (כוסות↔כוסות, קרה↔קרה, חמה↔חמה, ספוט↔ספוט, פרופיל↔פרופיל) → likely MATCH
4. Same catalog number → definite MATCH, but different catalog numbers do NOT mean different products
5. Similar technical specs (wattage, color temp, dimensions, pack size like "3000") confirm the match
6. If quantities differ but are within 10% of each other AND descriptions share any significant keyword → assume it's the same product
{{LEARNED_MAPPINGS}}
Purchase Order Items (0-indexed):
{{PO_ITEMS}}

Delivery Note Items (0-indexed):
{{DN_ITEMS}}

Invoice Items (0-indexed):
{{INV_ITEMS}}

Return ONLY valid JSON (no markdown, no explanation):
{
  "matches": [
    {"po": 0, "dn": null, "inv": 3, "confidence": 0.85}
  ]
}

Rules:
- Match items that refer to the same product, even if described VERY differently
- Use null when an item has no counterpart in a document list (or if the list is empty)
- confidence: 0.0-1.0 indicating match certainty
- Each index should appear at most once across all matches
- Try to match EVERY item — only leave items unmatched if truly no counterpart exists
- When quantities match and product categories are similar, prefer matching over not matching
