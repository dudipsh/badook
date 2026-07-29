// ─── Synthetic Document Engine Configuration ───

import type { DocumentType } from '../../src/ocr/ocr.types';

// ─── Document generation ratios ───

export const DOC_TYPE_RATIOS: Record<DocumentType, number> = {
  delivery_note: 167,
  invoice: 111,
  purchase_order: 92,
};

// ─── Line items ───

export const LINE_ITEMS_MIN = 3;
export const LINE_ITEMS_MAX = 15;

/** Weights for line-item count (index 0 = LINE_ITEMS_MIN). Favors 5-10. */
export const LINE_ITEMS_WEIGHTS: number[] = [
  1, 2, 5, 8, 10, 10, 10, 8, 5, 3, 2, 1, 1,
  //3  4  5  6   7   8   9 10 11 12 13 14 15
];

// ─── Price jitter ───

export const PRICE_JITTER_MIN = 0.7;
export const PRICE_JITTER_MAX = 1.3;

// ─── Null probabilities per field (0-1) ───

export const NULL_PROBABILITIES: Record<string, number> = {
  supplierAddress: 0.20,
  supplierPhone: 0.30,
  supplierBusinessId: 0.25,
  catalogNumber: 0.40,
  notes: 0.60,
  unitPriceDN: 0.15, // unitPrice null probability for delivery notes
};

// ─── Discounts ───

export const DISCOUNT_PROBABILITY = 0.15;
export const DISCOUNT_MIN_PERCENT = 5;
export const DISCOUNT_MAX_PERCENT = 25;

// ─── VAT ───

export const VAT_RATE = 0.17;

// ─── Israeli construction company names (customers) ───

export const CUSTOMER_NAMES: string[] = [
  'שיכון ובינוי',
  'אפריקה ישראל מגורים',
  'חברת אלקטרה בניה',
  'דניה סיבוס',
  'אשטרום חברה להנדסה',
  'מנרב הנדסה ובניה',
  'אורון קבוצה',
  'בוני התיכון',
  'יעקב גרוס בניה',
  'גינדי השקעות',
  'אזורים',
  'קרדן נדל"ן',
  'אקרשטיין תעשיות',
  'רם אדרת',
  'שפיר הנדסה',
  'סולל בונה',
  'חברת אביב בניה',
  'לוזון קבוצה',
  'ענבל אור',
  'דמרי בנייה',
  'צמח המרמן',
  'נתנאל גרופ',
  'קבוצת רכבי',
  'יורו ישראל',
  'חנן מור',
  'מצלאוי קבוצת בניה',
  'אאורה',
  'בארי קבוצה',
  'חברת יצחק ברמן',
  'קרסו נדל"ן',
];

// ─── Israeli street names ───

export const STREET_NAMES: string[] = [
  'הרצל',
  'בן גוריון',
  'ז\'בוטינסקי',
  'ויצמן',
  'רוטשילד',
  'אלנבי',
  'דיזנגוף',
  'בגין',
  'רבין',
  'הנשיא',
  'השלום',
  'העצמאות',
  'סוקולוב',
  'ביאליק',
  'אחד העם',
  'יפו',
  'שדרות ירושלים',
  'כצנלסון',
  'נורדאו',
  'ברנר',
];

// ─── Construction project names ───

export const PROJECT_NAMES: string[] = [
  'פארק המדע',
  'שכונת הפארק',
  'מתחם התעשייה החדש',
  'פרויקט פינוי-בינוי רמת גן',
  'מגדלי הים',
  'שכונת נאות אשלים',
  'פרויקט הרכבת הקלה',
  'מתחם שרונה',
  'מגדל אקרו',
  'פרויקט מרכז העיר',
  'שכונת הגורן',
  'מתחם סביון',
  'פינוי-בינוי קרית אונו',
  'מגדלי הארגמן',
  'שכונת האלה',
  'פרויקט רמות',
  'מתחם שוק הכרמל',
  'מגדלי West',
  'הקריה האקדמית',
  'פרויקט הנמל',
];

// ─── Handwritten notes & rejection reasons for delivery notes ───

export const HANDWRITTEN_NOTES: string[] = [
  'חסר',
  'שבור',
  'בוצע',
  'OK',
  'נבדק',
  'תקין',
  'חלקי',
];

export const REJECTION_REASONS: string[] = [
  'פריט פגום',
  'כמות שגויה',
  'לא הוזמן',
  'פריט שבור',
  'לא מתאים להזמנה',
  'אריזה פתוחה',
];

// ─── Document number prefixes ───

// v2.0.3: Removed English prefixes (DN-, INV-, PO-) that leaked into model output
export const DN_PREFIXES = ['', '', '', '', 'ת-', 'מ-'];
export const INV_PREFIXES = ['', '', '', '', 'ח-', 'חש-'];
export const PO_PREFIXES = ['', '', '', '', 'הז-', 'הזמנה-'];

// ─── Invoice due-date offsets (days) ───

export const DUE_DATE_OFFSETS = [30, 60, 90];

// ─── Unit categorization for quantity logic ───

/** Units that should produce integer quantities (1-500) */
export const INTEGER_UNITS = ['יח\'', 'שק', 'גליל', 'לוח', 'חבילה', 'יחידה', 'קרש', 'ארגז', 'פח'];

/** Units that should produce decimal quantities with 1-2 decimal places */
export const DECIMAL_UNITS = ['מ"ר', 'מטר', 'ק"ג', 'טון', 'ליטר', 'מ"ק'];

// ─── Template mapping per document type ───

export const TEMPLATE_MAP: Record<DocumentType, string> = {
  delivery_note: 'delivery-note-template',
  invoice: 'invoice-template',
  purchase_order: 'purchase-order-template',
};
