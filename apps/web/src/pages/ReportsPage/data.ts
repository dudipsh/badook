import type { ReportRow } from './types';

// All vendor, project and person names below are fabricated demo data.
export const MOCK_REPORT_DATA: ReportRow[] = [
  { vendorName: 'א. דוגמה מפעלי מתכת בע"מ', amount: 3650, notes: 'נזק דלת אש ממד קומה 09', poNumber: 1560483, dcNumber: 1561524, date: '8/05/2024' },
  { vendorName: 'א.ב שיווק חומרי איטום בע"מ', amount: 5250, notes: 'לשירותים ומקלחת-סופי', poNumber: 1562846, dcNumber: 1566216, date: '24/05/2024' },
  { vendorName: 'אגמים חללי עבודה משותפים', amount: 9000, notes: 'לבדוק מול הרכש', poNumber: 1562298, dcNumber: 1567979, date: '10/05/2024' },
  { vendorName: 'אופק דיזיין איי פי בע"מ', amount: 34448.3, notes: 'הערכה ראשונית', poNumber: 1565105, dcNumber: 1564617, date: '12/05/2024' },
  { vendorName: 'אחים דוגמה יבוא ושיווק בע"מ', amount: 120.3, notes: 'מה שאין במחסן', poNumber: 1563635, dcNumber: 1567412, date: '18/05/2024' },
  { vendorName: 'איי-בי ישראל בע"מ', amount: 1700, notes: '986259', poNumber: 1564428, dcNumber: 1562514, date: '11/05/2024' },
  { vendorName: 'אינוליין בע"מ', amount: 2540000, notes: '85708+85705+86108', poNumber: 1566694, dcNumber: 1564455, date: '1/05/2024' },
  { vendorName: 'אבנר דוגמן - דוגמן פרויקטים', amount: 885436.45, notes: '', poNumber: 1567301, dcNumber: 1560400, date: '1/05/2024' },
  { vendorName: 'אלקטרון בנייה בע"מ', amount: 4940000, notes: '85707', poNumber: 1561375, dcNumber: 1564626, date: '18/05/2024' },
  { vendorName: 'אמ.די.אל שיווק מוצרי בניה בע"מ', amount: 689.83, notes: 'מוצרי איטום', poNumber: 1566180, dcNumber: 1560267, date: '10/05/2024' },
  { vendorName: 'אורות נדל"ן - מגדל הדוגמה חניון צפוני', amount: 67200, notes: 'חניונים', poNumber: 1562928, dcNumber: 1565173, date: '13/05/2024' },
  { vendorName: 'ארט סימן בע"מ', amount: 845, notes: 'צמידים לזיהוי כנגד קרוסלות', poNumber: 1567240, dcNumber: 1560168, date: '27/05/2024' },
  { vendorName: 'אתגר הבנייה בע"מ', amount: 1144727.45, notes: 'הערכה לסיום עד יולי', poNumber: 1560626, dcNumber: 1560687, date: '20/05/2024' },
  { vendorName: 'ב. גוונים בצבע 2010 בע"מ', amount: 750000, notes: 'הערכה ראשונית', poNumber: 1563351, dcNumber: 1563436, date: '17/05/2024' },
  { vendorName: 'ב.ט.ח - חברת הביטוח לדוגמה בע"מ', amount: 37096.6, notes: 'ביטוח', poNumber: 1565506, dcNumber: 1563225, date: '11/05/2024' },
  { vendorName: 'בי-לוג מוצרי בניה מתקדמים בע"מ', amount: 11160.17, notes: 'מוצרים מתקדמים', poNumber: 1565840, dcNumber: 1566391, date: '14/05/2024' },
  { vendorName: 'בי.אל טכנולוגיות בע"מ', amount: 115754.25, notes: '', poNumber: 1561152, dcNumber: 1563042, date: '10/05/2024' },
  { vendorName: 'בן דוגמה צבעים (צפון - דרום) בע"מ', amount: 3361.02, notes: 'כנראה יהיה עוד', poNumber: 1560571, dcNumber: 1561659, date: '17/05/2024' },
  { vendorName: 'ברק דוגמני', amount: 3350, notes: 'חגורות בטון', poNumber: 1560039, dcNumber: 1566316, date: '6/05/2024' },
  { vendorName: 'מר זכוכית בע"מ', amount: 4800, notes: 'נזקי בניין85787', poNumber: 1562560, dcNumber: 1567516, date: '26/05/2024' },
  { vendorName: 'דף לבן העתקות 2000 בע"מ', amount: 1000, notes: 'לוודא מול הרכש', poNumber: 1565407, dcNumber: 1563887, date: '27/05/2024' },
  { vendorName: 'הד מדיה בע"מ', amount: 2283586.61, notes: '86581', poNumber: 1564615, dcNumber: 1560925, date: '11/05/2024' },
  { vendorName: 'הייטון (א.ב.) בע"מ', amount: 19990, notes: '85627', poNumber: 1560348, dcNumber: 1564256, date: '18/05/2024' },
  { vendorName: 'הדוגמה ושות\' בע"מ', amount: 14800, notes: 'חול', poNumber: 1561747, dcNumber: 1566987, date: '14/05/2024' },
  { vendorName: 'הביטוח לדוגמה בע"מ', amount: 350000, notes: 'הערכה עבור ביטוח לפרויקט 0.7 אחוז מ 50 מיליון', poNumber: 1563843, dcNumber: 1562085, date: '24/05/2024' },
  { vendorName: 'ויטל פרויקטים בע"מ', amount: 19861.17, notes: 'סופי 86447', poNumber: 1560560, dcNumber: 1565086, date: '24/05/2024' },
];

export const MOCK_PROJECTS = [
  { value: 'P1', label: 'מגדל הדוגמה - צפון' },
  { value: 'P2', label: 'מתחם T1 - מרכז' },
  { value: 'P3', label: 'מתחם העסקים - עיר לדוגמה' },
];

export const MOCK_VENDORS = [
  { value: 'V1', label: 'א. דוגמה מפעלי מתכת בע"מ' },
  { value: 'V2', label: 'אינוליין בע"מ' },
  { value: 'V3', label: 'הביטוח לדוגמה בע"מ' },
];

export const MOCK_MONTHS = [
  { value: '04/24', label: 'אפריל 2024' },
  { value: '05/24', label: 'מאי 2024' },
];
