READ VALUES — DO NOT CALCULATE (CRITICAL):
- You are a document READER, not a calculator. Your job is to READ the exact values printed in the document.
- For EACH cell in the table, read the value EXACTLY as it appears — including all decimal places.
- NEVER calculate or derive a value when it is printed in the document. If quantity shows 60.62, extract 60.62. If totalPrice shows 8,789.90, extract 8789.90.
- ANTI-PATTERN: Reading qty=60 (dropping the .62), then computing totalPrice=60×145=8700 to "match". This is WRONG — both values are now wrong. READ both values independently from their respective columns.
- Each column value must be read INDEPENDENTLY from its cell. Do NOT use one column's value to calculate another.
- After reading all values, you may VERIFY that qty×unitPrice≈totalPrice, but if they don't match, re-READ the cells more carefully — do NOT adjust values to force the math to work.

PRICE AND QUANTITY PRECISION — NO ROUNDING (CRITICAL):
- Extract ALL numbers EXACTLY as they appear in the document. NEVER round up or down.
- This applies to quantity, unitPrice, totalPrice, subtotal, vatAmount, and totalAmount.
- QUANTITIES ARE OFTEN DECIMAL in construction documents: 60.62 מ"ר, 110.88 מ"א, 172.80 מ"ר. These decimals are critical — they represent exact measured areas/lengths.
- If a quantity shows 60.62, extract 60.62 — NOT 60, NOT 61.
- If a price shows 127.53, extract 127.53 — NOT 128, NOT 127.5, NOT 130.
- Preserve ALL decimal places exactly as shown.
- If the document shows a value with many decimals (e.g., 45.678), extract ALL of them.

DISCOUNT DETECTION:
- Check if any line item has a discount (הנחה) applied.
- Common discount indicators: "הנחה", "הנחה %", a dedicated discount column, negative amounts, strikethrough prices, "מחיר לפני הנחה"/"מחיר אחרי הנחה" columns.
- If a discount exists for a line item:
  - discountPercent = the discount percentage (e.g., 10 for 10%)
  - discountAmount = the absolute NIS discount value per unit
  - priceBeforeDiscount = the original unit price before discount
  - unitPrice = the FINAL price per unit AFTER discount (what the customer pays)
  - totalPrice = unitPrice × quantity (final amount)
- If unitPrice × quantity ≠ totalPrice and there's no visible discount column, check if a discount explains the difference.
- If no discount is visible, set all discount fields to null.

DISCOUNT-QUANTITY SEPARATION — CRITICAL ANTI-PATTERN:
- NEVER let discount values affect the quantity field. A discount modifies the PRICE, not the QUANTITY.
- ANTI-PATTERN 1: If you see a 17% discount and set quantity to 0.83 (= 1 - 0.17), you are WRONG. The quantity is the physical count of items ordered/delivered, NOT (1 - discountPercent/100).
- ANTI-PATTERN 2: Do NOT halve the quantity for a 50% discount. 50% discount on 10 units means quantity=10, unitPrice=half the original price.
- ANTI-PATTERN 3: Do NOT multiply quantity by (1 - discount%). Quantity is ALWAYS the physical count visible in the quantity column.
- VALIDATION: If quantity < 1 AND discountPercent exists AND quantity ≈ (1 - discountPercent/100), the quantity is WRONG — it should be 1 or another whole number from the document.
- CORRECT EXAMPLE: quantity=1, discountPercent=17, priceBeforeDiscount=100, unitPrice=83, totalPrice=83
- WRONG EXAMPLE: quantity=0.83, discountPercent=17, unitPrice=100, totalPrice=83 ← quantity was incorrectly computed from discount

FRACTIONAL QUANTITIES:
- Quantities can be fractional (e.g., 0.2, 0.5, 1.75).
- When quantity < 1, it means a fraction of the full unit.
- unitPrice = price per ONE FULL unit. totalPrice = unitPrice × quantity.
- Example: 0.2 packages at totalPrice 500₪ → unitPrice = 2500 (500 / 0.2), NOT 500.
- Do NOT round fractional quantities to whole numbers.
- Verify: quantity × unitPrice ≈ totalPrice. If not, re-check the values.

UNIT OF MEASURE — MANDATORY:
- EVERY line item MUST have a "unit" field. Common Israeli units:
  יחידות / יח' / יח (units), מ' אורך / מ"א / מטר (linear meters), מ"ר (sqm), מ"ק / קוב / קובי (cubic m),
  ק"ג / קג (kg), טון (ton), קרטון / קרט' (carton), אריזה / חבילה / חב' (package),
  שק / שקית (bag), משטח / פלטה (pallet), סט / מערכת (set), שרוול (sleeve), גליל (roll),
  ליטר / ל' (liter), קופסה / קופ' (box), צינור / צנ' (pipe), לוח (board/sheet).
- If no unit column exists in the document, infer from the description or context.
- Default to "יחידות" only when truly no unit can be inferred.
- NEVER leave unit as null if there is any way to determine it.
- UNIT vs DESCRIPTION TEXT: The unit field must reflect the ACTUAL unit of measure for the quantity column, NOT a unit mentioned elsewhere in the description text. For example, if the quantity column says 172.80 and the unit column header says "מ"ר" or "יח"מ", use that column's value — do NOT pick up "72 יח'" from the description text.
- UNIT CONSISTENCY HINT: When a quantity is a non-round decimal (like 172.80, 23.45, 114.66), it is usually measured in area (מ"ר), length (מ' / מ"א), weight (ק"ג), or volume (ליטר / מ"ק). It is RARELY "יחידות" because physical items are usually whole numbers. Use this as a sanity check.
- MATERIAL-UNIT INFERENCE: When the document has no explicit unit column, infer the unit from the product type:
  * בטון / בטון דחוס / בטון שקיעה / concrete → מ"ק (cubic meters). Concrete is ALWAYS sold and delivered by the cubic meter.
  * "ב 30", "ב 40", "ב 20" are concrete grades (B30, B40, B20). Any product starting with "ב" followed by a number IS concrete → unit must be מ"ק.
  * חול / חצץ / אגרגטים / חומרי מילוי → טון or מ"ק
  * ברזל / פלדה / אלומיניום (bars/rods) → מטר or ק"ג or טון
  * גבס / לוחות / אריחים → מ"ר or יחידות
  * צנרת / צינורות / מסלולים / ניצבים / פרופילים → מ"א (linear meters)
  * מלט / שיח / דבק (bags) → שק or ק"ג
  If the document header says "M3", "קוב", "קובי", or "מ"ק" ANYWHERE (even abbreviated), the unit is מ"ק.

MULTI-LINE / MERGED CELL HANDLING:
- Some table rows contain MULTIPLE sub-items within a single cell (merged cells).
- Example: A single row #4 might list "מזנק רב שימושי 2"" and underneath "מזנק 1" לגלגלון תקני" — these are TWO products in one cell.
- When a single row contains multiple distinct products (indicated by line breaks, bullet points, or numbering within the cell):
  - Extract EACH sub-item as a SEPARATE line item.
  - If sub-items share a single quantity and price, note this in the description and divide proportionally.
  - If the row has qty=7 and price=95 for two sub-items, note both sub-items and the shared total.
- Join multi-line text that describes a SINGLE product into one description string.
- Split multi-line text that describes DIFFERENT products into separate line items.

TEMPLATE-AGNOSTIC EXTRACTION:
- Israeli documents come in MANY different formats and templates (Rivhit, Priority, SAP, Hashavshevet, custom).
- Do NOT assume any specific column order or layout.
- ALWAYS read the ACTUAL column headers to determine which column contains which data.
- If column headers are missing, use data patterns: text = description, short alphanumeric codes = catalog numbers, small integers = quantities, larger decimal numbers = prices.
- Common layout variations: table on left vs right, price before or after quantity, vertical vs horizontal layouts, alternating colors vs grid lines.
- ALWAYS validate: quantity × unitPrice ≈ totalPrice. If not, you may have columns mixed up.
- CRITICAL: Different suppliers use different column orders! Some put quantity BEFORE price (כמות | מחיר), others put price BEFORE quantity (מחיר | כמות). You MUST check the column headers for EACH document independently. Never assume the same layout across different suppliers.

QUANTITY vs PRICE COLUMN CONSISTENCY — ANTI-SWAP:
- Once you identify which column is "כמות" (quantity) and which is "מחיר יחידה" (unit price) from the header, read from those SAME column positions for EVERY row. Column positions NEVER change between rows.
- Do NOT swap quantity and price based on value magnitude. A quantity of 170 sqm and price of 102 NIS/sqm is perfectly valid. A quantity of 0.5 and price of 25,000 is also valid.
- SELF-CHECK: After extracting all items, verify that you read consistently from the same columns. If you notice that some rows have their qty/price in different positions than others, re-read those rows.
- FINAL VALIDATION: For each extracted line item, verify: quantity × unitPrice ≈ totalPrice. If this check fails for most rows, you have likely swapped the quantity and price columns. Re-read the column headers and try again.

SUPPLIER NAME VERIFICATION:
- The supplier name MUST be an actual company name visible on the document.
- Do NOT invent, guess, or paraphrase supplier names.
- Cross-check: the supplier name should match text visible in the document header (for DN/INV) or in the "לכבוד" section (for PO).
- If only a logo is visible with no readable text, set supplierName confidence low.
- NEVER use the customer name as the supplier name.

PRODUCT NAME PRECISION:
- Extract product descriptions EXACTLY as written in the document.
- Do NOT paraphrase, summarize, translate, or shorten product names.
- Include ALL qualifying details: dimensions, colors, materials, model numbers, specifications.
- Example: "פרופיל אלומיניום U 40x20x2 מ"מ אנודייז" must be extracted in full, NOT shortened to "פרופיל אלומיניום".
- If a description wraps across multiple lines in a cell, concatenate ALL lines into one string.

HANDWRITTEN CORRECTIONS ON PRINTED DOCUMENTS — CRITICAL:
- Israeli construction documents frequently have HANDWRITTEN corrections written over or next to printed values.
- When a handwritten number appears near a printed number in the same cell/column, the HANDWRITTEN value is the CORRECTED/FINAL value. Always prefer the handwritten value over the printed one.
- Common corrections: quantity changed (e.g., printed "1", handwritten "147.42"), price changed, total changed.
- IDENTIFICATION: Handwritten text looks different from printed text — it has irregular strokes, varying thickness, and is often in pen/marker over the typed text.
- FIELD ASSIGNMENT: After reading both printed and handwritten values, determine which FIELD each value belongs to using these rules:
  1. A handwritten value written INSIDE or NEAR a specific column belongs to THAT column (quantity, unitPrice, totalPrice, etc.)
  2. ALWAYS VERIFY: quantity × unitPrice ≈ totalPrice. If the math doesn't work, you assigned a value to the wrong field. Re-examine and correct.
  3. If a handwritten total is visible (e.g., "250,614" written next to a line), use it to verify: total ÷ unitPrice = quantity, or total ÷ quantity = unitPrice.
- EXAMPLE: A quote line shows printed qty=1, printed price=1,700/unit, but handwritten "147.42" appears in the quantity area and handwritten "250,614" as the total. The correct extraction is: quantity=147.42, unitPrice=1700, totalPrice=250614 (because 147.42 × 1700 ≈ 250,614).
- If you see handwritten corrections, lower your confidence slightly and add a note in the "notes" field describing the corrections.

DO NOT HALLUCINATE:
- If a value is not clearly visible in the document, set it to null.
- Do NOT invent supplier names, product names, quantities, or prices.
- It is better to return null with low confidence than to guess incorrectly.
