// ─── Synthetic Document Data Generator ───

import { PrismaClient } from '../../src/generated/prisma-client';
import type {
  DocumentType,
  ParsedDeliveryNote,
  ParsedInvoice,
  ParsedPurchaseOrder,
} from '../../src/ocr/ocr.types';
import {
  DOC_TYPE_RATIOS,
  LINE_ITEMS_MIN,
  LINE_ITEMS_MAX,
  LINE_ITEMS_WEIGHTS,
  PRICE_JITTER_MIN,
  PRICE_JITTER_MAX,
  NULL_PROBABILITIES,
  DISCOUNT_PROBABILITY,
  DISCOUNT_MIN_PERCENT,
  DISCOUNT_MAX_PERCENT,
  VAT_RATE,
  CUSTOMER_NAMES,
  STREET_NAMES,
  PROJECT_NAMES,
  HANDWRITTEN_NOTES,
  REJECTION_REASONS,
  DN_PREFIXES,
  INV_PREFIXES,
  PO_PREFIXES,
  DUE_DATE_OFFSETS,
  INTEGER_UNITS,
  DECIMAL_UNITS,
} from './config';

// ─── Types ───

interface RefSupplierRow {
  id: string;
  name: string;
  categories: string[];
  phone: string | null;
  address: string | null;
}

interface RefProductRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  avgPrice: number;
  variants: string[];
  commonVendors: string[];
}

interface RefCityRow {
  id: string;
  name: string;
  district: string;
}

interface RefData {
  suppliers: RefSupplierRow[];
  products: RefProductRow[];
  cities: RefCityRow[];
  productsByCategory: Map<string, RefProductRow[]>;
}

export type SyntheticDocument =
  | { type: 'delivery_note'; data: ParsedDeliveryNote }
  | { type: 'invoice'; data: ParsedInvoice }
  | { type: 'purchase_order'; data: ParsedPurchaseOrder };

// ─── Seeded PRNG (mulberry32) ───

const createRng = (seed: number) => {
  let state = seed | 0;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ─── RNG helper class ───

class SeededRandom {
  private next: () => number;

  constructor(seed: number) {
    this.next = createRng(seed);
  }

  /** Returns a float in [0, 1) */
  random(): number {
    return this.next();
  }

  /** Returns an integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /** Returns a float in [min, max) */
  float(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  /** Returns a float rounded to `decimals` places */
  decimal(min: number, max: number, decimals: number): number {
    const val = this.float(min, max);
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  /** Picks a random element from an array */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.random() * arr.length)];
  }

  /** Picks N unique random elements from an array */
  pickN<T>(arr: readonly T[], n: number): T[] {
    const copy = [...arr];
    const result: T[] = [];
    const count = Math.min(n, copy.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(this.random() * copy.length);
      result.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return result;
  }

  /** Returns true with probability p */
  chance(p: number): boolean {
    return this.random() < p;
  }

  /** Weighted random selection by index. Returns the chosen index. */
  weightedIndex(weights: readonly number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  /** Shuffle an array in place (Fisher-Yates) */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// ─── Utility helpers ───

const round2 = (n: number): number => Math.round(n * 100) / 100;

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const isIntegerUnit = (unit: string): boolean => {
  return INTEGER_UNITS.some((u) => unit.includes(u));
};

const isDecimalUnit = (unit: string): boolean => {
  return DECIMAL_UNITS.some((u) => unit.includes(u));
};

// ─── Data loading ───

const loadRefData = async (prisma: PrismaClient): Promise<RefData> => {
  const [suppliers, products, cities] = await Promise.all([
    prisma.refSupplier.findMany(),
    prisma.refProduct.findMany(),
    prisma.refCity.findMany(),
  ]);

  const productsByCategory = new Map<string, RefProductRow[]>();
  for (const product of products) {
    const existing = productsByCategory.get(product.category) ?? [];
    existing.push(product);
    productsByCategory.set(product.category, existing);
  }

  return { suppliers, products, cities, productsByCategory };
};

// ─── Document number generation ───

const generateDocNumber = (rng: SeededRandom, prefixes: readonly string[]): string => {
  const prefix = rng.pick(prefixes);
  const digits = rng.int(4, 7);
  const num = rng.int(Math.pow(10, digits - 1), Math.pow(10, digits) - 1);
  return `${prefix}${num}`;
};

// ─── Date generation (last 12 months) ───

const generateDate = (rng: SeededRandom): Date => {
  const now = new Date();
  const yearAgo = new Date(now);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const range = now.getTime() - yearAgo.getTime();
  return new Date(yearAgo.getTime() + rng.random() * range);
};

// ─── Address generation ───

const generateAddress = (rng: SeededRandom, cities: RefCityRow[]): string => {
  const city = rng.pick(cities);
  const street = rng.pick(STREET_NAMES);
  const num = rng.int(1, 200);
  return `${street} ${num}, ${city.name}`;
};

// ─── Phone generation (Israeli format) ───

const generatePhone = (rng: SeededRandom): string => {
  const prefixes = ['050', '052', '053', '054', '058', '02', '03', '04', '08', '09'];
  const prefix = rng.pick(prefixes);
  const isMobile = prefix.startsWith('05');
  const suffixLen = isMobile ? 7 : 7;
  let suffix = '';
  for (let i = 0; i < suffixLen; i++) {
    suffix += rng.int(0, 9).toString();
  }
  return `${prefix}-${suffix}`;
};

// ─── Business ID generation (9-digit Israeli) ───

const generateBusinessId = (rng: SeededRandom): string => {
  let id = '';
  for (let i = 0; i < 9; i++) {
    id += rng.int(0, 9).toString();
  }
  return id;
};

// ─── Quantity generation ───

const generateQuantity = (rng: SeededRandom, unit: string): number => {
  if (isDecimalUnit(unit)) {
    return rng.decimal(0.5, 500, rng.int(1, 2));
  }
  if (isIntegerUnit(unit)) {
    return rng.int(1, 500);
  }
  // Fallback: treat unknown units as integer
  return rng.int(1, 100);
};

// ─── Line item count (weighted toward 5-10) ───

const pickLineItemCount = (rng: SeededRandom): number => {
  const idx = rng.weightedIndex(LINE_ITEMS_WEIGHTS);
  return LINE_ITEMS_MIN + idx;
};

// ─── Product selection for a supplier ───

const getProductsForSupplier = (
  supplier: RefSupplierRow,
  refData: RefData,
): RefProductRow[] => {
  if (supplier.categories.length === 0) {
    return refData.products;
  }

  const relevant: RefProductRow[] = [];
  for (const cat of supplier.categories) {
    const catProducts = refData.productsByCategory.get(cat);
    if (catProducts) {
      relevant.push(...catProducts);
    }
  }

  // If no products matched categories, fallback to all products
  return relevant.length > 0 ? relevant : refData.products;
};

// ─── Nullable field helper ───

const nullable = <T>(
  rng: SeededRandom,
  fieldKey: string,
  value: T,
): T | null => {
  const prob = NULL_PROBABILITIES[fieldKey];
  if (prob != null && rng.chance(prob)) {
    return null;
  }
  return value;
};

// ─── Document type picker (weighted by ratios) ───

const pickDocumentType = (rng: SeededRandom): DocumentType => {
  const types: DocumentType[] = ['delivery_note', 'invoice', 'purchase_order'];
  const weights = types.map((t) => DOC_TYPE_RATIOS[t]);
  const idx = rng.weightedIndex(weights);
  return types[idx];
};

// ─── Core generators per document type ───

const generateDeliveryNote = (
  rng: SeededRandom,
  supplier: RefSupplierRow,
  products: RefProductRow[],
  refData: RefData,
): ParsedDeliveryNote => {
  const date = generateDate(rng);
  const numItems = pickLineItemCount(rng);
  const selectedProducts = rng.pickN(products, numItems);

  const lineItems = selectedProducts.map((product) => {
    const quantity = generateQuantity(rng, product.unit);
    const jitter = rng.float(PRICE_JITTER_MIN, PRICE_JITTER_MAX);
    const rawUnitPrice = round2(product.avgPrice * jitter);
    const unitPriceNullable = rng.chance(NULL_PROBABILITIES.unitPriceDN)
      ? null
      : rawUnitPrice;

    let discountPercent: number | null = null;
    let discountAmount: number | null = null;
    let priceBeforeDiscount: number | null = null;
    let totalPrice: number | null = null;

    if (unitPriceNullable != null) {
      const baseTotal = round2(quantity * unitPriceNullable);

      if (rng.chance(DISCOUNT_PROBABILITY)) {
        discountPercent = rng.int(DISCOUNT_MIN_PERCENT, DISCOUNT_MAX_PERCENT);
        priceBeforeDiscount = baseTotal;
        discountAmount = round2(baseTotal * (discountPercent / 100));
        totalPrice = round2(baseTotal - discountAmount);
      } else {
        totalPrice = baseTotal;
      }
    }

    // Delivery note specifics
    let receivedQuantity: number | null = null;
    let handwrittenNotes: string | null = null;
    if (rng.chance(0.2)) {
      receivedQuantity = isDecimalUnit(product.unit)
        ? round2(quantity * rng.float(0.85, 1.0))
        : Math.max(1, quantity - rng.int(0, Math.max(1, Math.floor(quantity * 0.15))));
    }
    if (rng.chance(0.15)) {
      handwrittenNotes = rng.pick(HANDWRITTEN_NOTES);
    }

    return {
      description: product.name,
      catalogNumber: nullable(rng, 'catalogNumber', generateDocNumber(rng, ['', '', 'CAT-'])),
      quantity,
      unit: product.unit,
      unitPrice: unitPriceNullable,
      totalPrice,
      discountPercent,
      discountAmount,
      priceBeforeDiscount,
      receivedQuantity,
      handwrittenNotes,
      remarks: null as string | null,
      quantityBreakdown: null,
    };
  });

  // Calculate totals (only from items with totalPrice)
  const subtotal = round2(
    lineItems.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0),
  );
  const vatAmount = round2(subtotal * VAT_RATE);
  const totalAmount = round2(subtotal + vatAmount);

  // Occasionally add rejected items
  let rejectedItems: Array<{ index: number; reason: string }> | undefined;
  if (rng.chance(0.1) && lineItems.length > 2) {
    const rejectCount = rng.int(1, 2);
    const indices = rng.pickN(
      lineItems.map((_, i) => i),
      rejectCount,
    );
    rejectedItems = indices.map((index) => ({
      index,
      reason: rng.pick(REJECTION_REASONS),
    }));
  }

  return {
    noteNumber: generateDocNumber(rng, DN_PREFIXES),
    supplierName: supplier.name,
    supplierAddress: nullable(rng, 'supplierAddress', supplier.address ?? generateAddress(rng, refData.cities)),
    supplierPhone: nullable(rng, 'supplierPhone', supplier.phone ?? generatePhone(rng)),
    supplierBusinessId: nullable(rng, 'supplierBusinessId', generateBusinessId(rng)),
    customerName: rng.pick(CUSTOMER_NAMES),
    deliveryDate: formatDate(date),
    deliveryAddress: generateAddress(rng, refData.cities),
    projectName: rng.chance(0.7) ? rng.pick(PROJECT_NAMES) : null,
    poReference: rng.chance(0.5) ? generateDocNumber(rng, PO_PREFIXES) : null,
    orderReference: rng.chance(0.3) ? generateDocNumber(rng, ['', 'REF-']) : null,
    lineItems,
    rejectedItems,
    subtotal,
    vatRate: VAT_RATE,
    vatAmount,
    totalAmount,
    notes: nullable(rng, 'notes', rng.pick([
      'נא לאשר קבלה',
      'משלוח חלקי',
      'יתרת ההזמנה בהמשך',
      'נא לבדוק את הסחורה בקבלה',
      'אספקה למחסן ראשי',
    ])),
    confidence: 1.0,
    fieldConfidence: {},
  };
};

const generateInvoice = (
  rng: SeededRandom,
  supplier: RefSupplierRow,
  products: RefProductRow[],
  refData: RefData,
): ParsedInvoice => {
  const date = generateDate(rng);
  const dueOffset = rng.pick(DUE_DATE_OFFSETS);
  const dueDate = addDays(date, dueOffset);
  const numItems = pickLineItemCount(rng);
  const selectedProducts = rng.pickN(products, numItems);

  const lineItems = selectedProducts.map((product) => {
    const quantity = generateQuantity(rng, product.unit);
    const jitter = rng.float(PRICE_JITTER_MIN, PRICE_JITTER_MAX);
    const unitPrice = round2(product.avgPrice * jitter);
    const baseTotal = round2(quantity * unitPrice);

    let discountPercent: number | null = null;
    let discountAmount: number | null = null;
    let priceBeforeDiscount: number | null = null;
    let totalPrice: number;

    if (rng.chance(DISCOUNT_PROBABILITY)) {
      discountPercent = rng.int(DISCOUNT_MIN_PERCENT, DISCOUNT_MAX_PERCENT);
      priceBeforeDiscount = baseTotal;
      discountAmount = round2(baseTotal * (discountPercent / 100));
      totalPrice = round2(baseTotal - discountAmount);
    } else {
      totalPrice = baseTotal;
    }

    return {
      description: product.name,
      catalogNumber: nullable(rng, 'catalogNumber', generateDocNumber(rng, ['', '', 'CAT-'])),
      quantity,
      unit: product.unit,
      unitPrice,
      totalPrice,
      discountPercent,
      discountAmount,
      priceBeforeDiscount,
      remarks: null as string | null,
    };
  });

  const subtotal = round2(
    lineItems.reduce((sum, item) => sum + item.totalPrice, 0),
  );
  const vatAmount = round2(subtotal * VAT_RATE);
  const totalAmount = round2(subtotal + vatAmount);

  // Generate 1-3 delivery note references
  const dnRefCount = rng.int(1, 3);
  const deliveryNoteReferences: string[] = [];
  for (let i = 0; i < dnRefCount; i++) {
    deliveryNoteReferences.push(generateDocNumber(rng, DN_PREFIXES));
  }

  return {
    invoiceNumber: generateDocNumber(rng, INV_PREFIXES),
    supplierName: supplier.name,
    supplierAddress: nullable(rng, 'supplierAddress', supplier.address ?? generateAddress(rng, refData.cities)),
    supplierPhone: nullable(rng, 'supplierPhone', supplier.phone ?? generatePhone(rng)),
    supplierBusinessId: nullable(rng, 'supplierBusinessId', generateBusinessId(rng)),
    customerName: rng.pick(CUSTOMER_NAMES),
    invoiceDate: formatDate(date),
    dueDate: formatDate(dueDate),
    poReference: rng.chance(0.5) ? generateDocNumber(rng, PO_PREFIXES) : null,
    quoteReference: rng.chance(0.2) ? generateDocNumber(rng, ['', 'Q-', 'הצ-']) : null,
    deliveryNoteReferences,
    lineItems,
    subtotal,
    vatRate: VAT_RATE,
    vatAmount,
    totalAmount,
    notes: nullable(rng, 'notes', rng.pick([
      'תשלום שוטף + 30',
      'נא לשלם עד תאריך הפירעון',
      'כולל מע"מ',
      'לתשומת לב: חשבונית זו כוללת פריטים ממספר תעודות משלוח',
      'נא לציין מספר חשבונית בעת התשלום',
    ])),
    confidence: 1.0,
    fieldConfidence: {},
  };
};

const generatePurchaseOrder = (
  rng: SeededRandom,
  supplier: RefSupplierRow,
  products: RefProductRow[],
  refData: RefData,
): ParsedPurchaseOrder => {
  const date = generateDate(rng);
  const numItems = pickLineItemCount(rng);
  const selectedProducts = rng.pickN(products, numItems);
  const isPriceQuote = rng.chance(0.15);

  const lineItems = selectedProducts.map((product) => {
    const quantity = generateQuantity(rng, product.unit);
    const jitter = rng.float(PRICE_JITTER_MIN, PRICE_JITTER_MAX);
    const unitPrice = round2(product.avgPrice * jitter);
    const baseTotal = round2(quantity * unitPrice);

    let discountPercent: number | null = null;
    let discountAmount: number | null = null;
    let priceBeforeDiscount: number | null = null;
    let totalPrice: number;

    if (rng.chance(DISCOUNT_PROBABILITY)) {
      discountPercent = rng.int(DISCOUNT_MIN_PERCENT, DISCOUNT_MAX_PERCENT);
      priceBeforeDiscount = baseTotal;
      discountAmount = round2(baseTotal * (discountPercent / 100));
      totalPrice = round2(baseTotal - discountAmount);
    } else {
      totalPrice = baseTotal;
    }

    // Expected delivery date per line item (occasionally)
    let expectedDeliveryDate: string | null = null;
    if (rng.chance(0.4)) {
      expectedDeliveryDate = formatDate(addDays(date, rng.int(7, 90)));
    }

    return {
      description: product.name,
      catalogNumber: nullable(rng, 'catalogNumber', generateDocNumber(rng, ['', '', 'CAT-'])),
      quantity,
      unit: product.unit,
      unitPrice,
      totalPrice,
      discountPercent,
      discountAmount,
      priceBeforeDiscount,
      remarks: null as string | null,
      expectedDeliveryDate,
    };
  });

  const subtotal = round2(
    lineItems.reduce((sum, item) => sum + item.totalPrice, 0),
  );
  const vatAmount = round2(subtotal * VAT_RATE);
  const totalAmount = round2(subtotal + vatAmount);

  // Delivery note references (for POs that reference existing deliveries)
  let deliveryNoteReferences: string[] | null = null;
  if (rng.chance(0.2)) {
    const count = rng.int(1, 3);
    deliveryNoteReferences = [];
    for (let i = 0; i < count; i++) {
      deliveryNoteReferences.push(generateDocNumber(rng, DN_PREFIXES));
    }
  }

  return {
    poNumber: generateDocNumber(rng, PO_PREFIXES),
    supplierName: supplier.name,
    supplierAddress: nullable(rng, 'supplierAddress', supplier.address ?? generateAddress(rng, refData.cities)),
    supplierPhone: nullable(rng, 'supplierPhone', supplier.phone ?? generatePhone(rng)),
    supplierBusinessId: nullable(rng, 'supplierBusinessId', generateBusinessId(rng)),
    customerName: rng.pick(CUSTOMER_NAMES),
    deliveryAddress: generateAddress(rng, refData.cities),
    projectName: rng.chance(0.7) ? rng.pick(PROJECT_NAMES) : null,
    orderDate: formatDate(date),
    expectedDelivery: rng.chance(0.6)
      ? formatDate(addDays(date, rng.int(14, 120)))
      : null,
    supplierOrderNumber: rng.chance(0.3) ? generateDocNumber(rng, ['', 'SO-']) : null,
    quoteReference: rng.chance(0.25) ? generateDocNumber(rng, ['', 'Q-', 'הצ-']) : null,
    deliveryNoteReferences,
    documentSubtype: isPriceQuote ? 'price_quote' : null,
    lineItems,
    subtotal,
    vatRate: VAT_RATE,
    vatAmount,
    totalAmount,
    notes: nullable(rng, 'notes', rng.pick([
      'נא לספק בהתאם למפרט',
      'אספקה למחסן ראשי בלבד',
      'יש לתאם מועד אספקה מראש',
      'מחירים כוללים הובלה',
      'ההזמנה בתוקף ל-30 יום',
    ])),
    confidence: 1.0,
    fieldConfidence: {},
  };
};

// ─── Main DataGenerator class ───

export class DataGenerator {
  private prisma: PrismaClient;
  private refData: RefData | null = null;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
  }

  /** Load all reference data from DB into memory (call once before generating). */
  async init(): Promise<void> {
    this.refData = await loadRefData(this.prisma);

    if (this.refData.suppliers.length === 0) {
      throw new Error('No suppliers found in ref_suppliers table. Seed the reference data first.');
    }
    if (this.refData.products.length === 0) {
      throw new Error('No products found in ref_products table. Seed the reference data first.');
    }
    if (this.refData.cities.length === 0) {
      throw new Error('No cities found in ref_cities table. Seed the reference data first.');
    }

    console.log(
      `[DataGenerator] Loaded ${this.refData.suppliers.length} suppliers, ` +
      `${this.refData.products.length} products, ` +
      `${this.refData.cities.length} cities`,
    );
  }

  /** Generate a single synthetic document with a specific seed. */
  generateOne(seed: number, docType?: DocumentType): SyntheticDocument {
    if (!this.refData) {
      throw new Error('DataGenerator not initialized. Call init() first.');
    }

    const rng = new SeededRandom(seed);
    const type = docType ?? pickDocumentType(rng);

    // Pick a random supplier
    const supplier = rng.pick(this.refData.suppliers);

    // Get products relevant to this supplier's categories
    const products = getProductsForSupplier(supplier, this.refData);

    switch (type) {
      case 'delivery_note':
        return {
          type: 'delivery_note',
          data: generateDeliveryNote(rng, supplier, products, this.refData),
        };
      case 'invoice':
        return {
          type: 'invoice',
          data: generateInvoice(rng, supplier, products, this.refData),
        };
      case 'purchase_order':
        return {
          type: 'purchase_order',
          data: generatePurchaseOrder(rng, supplier, products, this.refData),
        };
    }
  }

  /** Generate a batch of documents with sequential seeds starting from baseSeed. */
  generateBatch(count: number, baseSeed: number = 1): SyntheticDocument[] {
    const results: SyntheticDocument[] = [];
    for (let i = 0; i < count; i++) {
      results.push(this.generateOne(baseSeed + i));
    }
    return results;
  }

  /**
   * Generate documents according to the configured ratios.
   * Returns the total number of documents specified by the ratios (2000 by default).
   */
  generateByRatios(baseSeed: number = 1): SyntheticDocument[] {
    const results: SyntheticDocument[] = [];
    let seedOffset = 0;

    for (const [docType, count] of Object.entries(DOC_TYPE_RATIOS)) {
      for (let i = 0; i < count; i++) {
        results.push(this.generateOne(baseSeed + seedOffset, docType as DocumentType));
        seedOffset++;
      }
    }

    // Shuffle so document types are interleaved
    const shuffleRng = new SeededRandom(baseSeed);
    shuffleRng.shuffle(results);

    return results;
  }

  /** Disconnect from the database. */
  async dispose(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
