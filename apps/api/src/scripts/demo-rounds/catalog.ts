// apps/api/src/scripts/demo-rounds/catalog.ts
import { DemoConfig } from './types';

// companyName is a placeholder so the generated set reads coherently
// (cosmetic — intake assigns the company by mailbox, not by text).
// Every supplier, business ID, address and phone below is invented; none of
// it corresponds to a real company.
export const DEFAULT_CONFIG: DemoConfig = {
  companyName: 'דוגמה הנדסה בע"מ',
  vatRate: 0.18,
  seed: 20260613,
  items: [
    {
      description: 'מלט שחור 25 ק"ג',
      // Order matters: the FNV pick lands ש. דוגמה + אלוני on the last alias and
      // טמבור on the first, so ש. דוגמה (the hero supplier) prints "שק מלט 25 ק\"ג".
      aliases: ['מלט CEM II/B 32.5 שק 25 ק"ג', 'מלט אפור שק 25 ק"ג', 'שק מלט 25 ק"ג'],
      catalogNumber: 'CEM-25B',
      unit: 'שק',
      priceMin: 14,
      priceMax: 25,
    },
    {
      description: 'פלס 80 ס"מ קפרו מגנטי',
      aliases: ['מאזנת קפרו 80 ס"מ מגנטית', 'פלס מים קפרו 80 ס"מ'],
      catalogNumber: 'KAP-985-80',
      unit: "יח'",
      priceMin: 140,
      priceMax: 200,
    },
    {
      description: 'ברזל מצולע 12 מ"מ 12 מטר',
      aliases: ['מוט ברזל מצולע קוטר 12 - 12 מ\'', 'ברזל זיון 12 מ"מ'],
      catalogNumber: 'STL-12-12',
      unit: 'מוט',
      priceMin: 38,
      priceMax: 52,
    },
    {
      description: 'בלוק פומיס 20',
      aliases: ['בלוק פומיס 20 ס"מ', 'בלוק קל 20'],
      catalogNumber: 'BLK-P20',
      unit: "יח'",
      priceMin: 9,
      priceMax: 14,
    },
    {
      description: 'דבק אריחים C2TE 25 ק"ג',
      aliases: ['דבק אריחים גמיש C2TE 25 ק"ג', 'דבק קרמיקה C2TE שק 25 ק"ג'],
      catalogNumber: 'ADH-C2TE',
      unit: 'שק',
      priceMin: 28,
      priceMax: 42,
    },
    {
      description: 'רשת ברזל מרותכת 15/15',
      aliases: ['רשת זיון מרותכת 15/15', 'רשת ברזל 15X15'],
      catalogNumber: 'MSH-1515',
      unit: "יח'",
      priceMin: 85,
      priceMax: 120,
    },
    {
      description: 'חול ים שטוף',
      aliases: ['חול ים שטוף - קוב', 'חול מחצבה שטוף'],
      catalogNumber: 'SND-1M3',
      unit: 'קוב',
      priceMin: 95,
      priceMax: 140,
    },
    {
      description: 'דיסק יהלום 230 מ"מ',
      aliases: ['דיסק חיתוך יהלום 230 מ"מ', 'דיסק יהלום קוטר 230'],
      catalogNumber: 'DSC-230',
      unit: "יח'",
      priceMin: 60,
      priceMax: 110,
    },
  ],
  suppliers: [
    {
      // Hero supplier used by most demo rounds — fully fabricated details.
      name: 'ש. דוגמה חומרי בנין (1990) בע"מ',
      businessId: '000000000',
      address: 'ת.ד. 100, עיר לדוגמה 0000000',
      phone: '09-0000000',
      docPrefix: 'SBN',
      pricesOnDeliveryNote: true,
      theme: { headerColor: [0.13, 0.29, 0.53], accentColor: [0.91, 0.95, 1.0], layout: 'classic' },
    },
    {
      name: 'אלוני שיווק חומרי בניין',
      businessId: '514876543',
      address: 'אזה"ת פולג, נתניה',
      phone: '09-8847711',
      docPrefix: 'ALN',
      pricesOnDeliveryNote: false,
      theme: { headerColor: [0.62, 0.18, 0.16], accentColor: [1.0, 0.94, 0.92], layout: 'banded' },
    },
    {
      name: 'מ.צ. כלי עבודה ובניין',
      businessId: '513219876',
      address: "רח' התעשייה 8, ראש העין",
      phone: '03-9028855',
      docPrefix: 'MTZ',
      pricesOnDeliveryNote: true,
      theme: { headerColor: [0.16, 0.42, 0.25], accentColor: [0.93, 1.0, 0.94], layout: 'minimal' },
    },
    {
      name: 'טמבור מרכז הבניין רעננה',
      businessId: '511987234',
      address: "רח' אחוזה 102, רעננה",
      phone: '09-7712233',
      docPrefix: 'TMB',
      pricesOnDeliveryNote: false,
      theme: { headerColor: [0.85, 0.49, 0.09], accentColor: [1.0, 0.97, 0.9], layout: 'classic' },
    },
    {
      name: 'בלוק יצהר תעשיות',
      businessId: '515432109',
      address: 'קיבוץ יצהר, עמק חפר',
      phone: '04-6362200',
      docPrefix: 'YTZ',
      pricesOnDeliveryNote: true,
      theme: { headerColor: [0.35, 0.23, 0.6], accentColor: [0.96, 0.94, 1.0], layout: 'banded' },
    },
  ],
  projects: [
    { name: 'אולם ספורט רעננה', address: "רח' הספורט 1, רעננה" },
    { name: 'מגדלי הים התיכון נתניה', address: "שד' בן גוריון 44, נתניה" },
    { name: 'בית ספר יסודי כפר סבא', address: "רח' החינוך 7, כפר סבא" },
    { name: 'חניון תת-קרקעי הרצליה', address: "רח' סוקולוב 19, הרצליה" },
  ],
};
