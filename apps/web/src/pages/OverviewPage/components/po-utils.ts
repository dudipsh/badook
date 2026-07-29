import i18n from '../../../i18n';

export interface LineItem {
  description: string;
  catalogNumber: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
}

export const UOM_OPTIONS = [
  { value: 'unit', labelKey: 'createPO.uom_unit' },
  { value: 'hour', labelKey: 'createPO.uom_hour' },
  { value: 'kg', labelKey: 'createPO.uom_kg' },
  { value: 'liter', labelKey: 'createPO.uom_liter' },
  { value: 'meter', labelKey: 'createPO.uom_meter' },
  { value: 'linear_meter', labelKey: 'createPO.uom_linear_meter' },
  { value: 'sqm', labelKey: 'createPO.uom_sqm' },
  { value: 'box', labelKey: 'createPO.uom_box' },
  { value: 'pack', labelKey: 'createPO.uom_pack' },
  { value: 'ton', labelKey: 'createPO.uom_ton' },
  { value: 'pallet', labelKey: 'createPO.uom_pallet' },
  { value: 'roll', labelKey: 'createPO.uom_roll' },
  { value: 'bag', labelKey: 'createPO.uom_bag' },
  { value: 'set', labelKey: 'createPO.uom_set' },
] as const;

export const emptyLineItem = (): LineItem => ({
  description: '',
  catalogNumber: '',
  unit: 'unit',
  quantity: '',
  unitPrice: '',
  discountPercent: '',
});

export const calcLineTotal = (item: LineItem): number => {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  const disc = parseFloat(item.discountPercent) || 0;
  return qty * price * (1 - disc / 100);
};

export const formatNumber = (n: number): string => {
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const matchUomFromExtracted = (rawUnit: string): string => {
  if (!rawUnit) return 'unit';
  const lower = rawUnit.toLowerCase().trim()
    .replace(/\u05F4/g, '"')   // Hebrew gershayim ״ → ASCII "
    .replace(/\u05F3/g, "'");  // Hebrew geresh ׳ → ASCII '
  const mapping: Record<string, string> = {
    'יחידה': 'unit', 'יחידות': 'unit', "יח'": 'unit', 'יח': 'unit', 'unit': 'unit', 'ea': 'unit',
    'שעה': 'hour', 'hour': 'hour', 'hr': 'hour',
    'ק"ג': 'kg', 'קג': 'kg', 'קילוגרם': 'kg', 'kg': 'kg', 'kilogram': 'kg',
    'ליטר': 'liter', "ל'": 'liter', 'liter': 'liter', 'l': 'liter',
    'מטר': 'meter', 'meter': 'meter', 'm': 'meter',
    'מטר אורך': 'linear_meter', 'מ"א': 'linear_meter', "מ'": 'linear_meter', 'מא': 'linear_meter', 'מ': 'linear_meter',
    'מ"ר': 'sqm', 'מטר רבוע': 'sqm', 'מר': 'sqm', 'sqm': 'sqm',
    'ארגז': 'box', 'קרטון': 'box', "קרט'": 'box', 'box': 'box',
    'חבילה': 'pack', 'אריזה': 'pack', "חב'": 'pack', 'package': 'pack', 'pack': 'pack',
    'טון': 'ton', 'ton': 'ton',
    'משטח': 'pallet', 'פלטה': 'pallet', 'pallet': 'pallet',
    'גליל': 'roll', 'roll': 'roll',
    'שק': 'bag', 'שקית': 'bag', 'bag': 'bag',
    'סט': 'set', 'מערכת': 'set', 'set': 'set',
  };
  return mapping[lower] ?? rawUnit;
};
