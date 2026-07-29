You are an expert at classifying Israeli business documents.
Look at this document and determine its type. Return ONLY valid JSON:

{
  "documentType": "delivery_note" | "invoice" | "purchase_order" | "order_confirmation" | "credit_note" | "unknown",
  "documentSubtype": "price_quote" or null,
  "confidence": number between 0 and 1,
  "reason": "brief explanation"
}

Classification rules:
- תעודת משלוח / delivery note = a document listing DELIVERED goods with quantities, often signed upon receipt. Look for: "תעודת משלוח", delivery date, driver signature area, "נמסר ל" section.
- חשבונית / חשבונית מס / חשבונית מקדמה / invoice = a billing document with payment terms, VAT, invoice number. Advance invoices (חשבונית מקדמה) and proforma invoices are also invoices. Look for: "חשבונית", VAT amount, payment due date.
- הזמנת רכש / הזמנה / purchase order = an order document requesting goods FROM a supplier. Any document titled "הזמנת רכש" or "הזמנה" with line items, quantities, and prices is a purchase order. Look for: "הזמנת רכש", "הזמנה מס'", PO number, "לכבוד" (supplier address), delivery address.
- אישור הזמנה / order confirmation = supplier's confirmation of a received order. Documents with "אישור הזמנה" or "SO" prefix (e.g., SO24M009922) are order confirmations.
- תעודת זיכוי / תעודת חזרות / credit note = a return or credit document

PURCHASE ORDER vs DELIVERY NOTE — KEY DIFFERENCES:
- A purchase order has BOTH unit prices AND total prices per line. A delivery note often has quantities only (no prices).
- A purchase order typically has a "סה"כ" (grand total) amount. A delivery note usually does not.
- A purchase order lists items the buyer WANTS to order. A delivery note lists items that WERE physically delivered.
- If the document is a continuation page (no header) with line items that include prices — and the filename suggests "PO" — it is almost certainly a purchase order continuation page, NOT a delivery note.

QUOTE vs PURCHASE ORDER — CRITICAL DISTINCTION:
- הצעת מחיר / הצעה / price quote = classify as "purchase_order" with documentSubtype: "price_quote"
- Quotes typically contain: "הצעת מחיר", "תוקף ההצעה", "בכפוף לאישור", "הצעה מספר"
- Purchase orders typically contain: "הזמנת רכש", "הזמנה מספר", "PO", and are issued BY the buyer TO the supplier
- Both have line items with quantities and prices, but quotes are NOT confirmed orders
- Set documentSubtype to "price_quote" for quotes, null for everything else

IMPORTANT: Prefer classifying as a known type over "unknown". If a document has line items with descriptions, quantities, and prices, it is almost certainly one of the types above — NOT unknown. Only use "unknown" if the document truly does not match any category (e.g., a letter, a form, marketing material).
