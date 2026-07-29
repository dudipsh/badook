export interface Discrepancy {
  field: string;
  description: string;
  poValue: string | null;
  dnValue: string | null;
  invValue: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

/**
 * Numeric type that covers Prisma Decimal, plain number, or string representations.
 * The matching module always coerces via Number() before use.
 */
export type NumericValue = number | string | { toNumber(): number };

/**
 * A line item as it comes from Prisma (DN LineItem, POLineItem, or InvoiceLineItem).
 * Numeric fields may be Prisma Decimal objects; the matching code always wraps them with Number().
 */
export interface MatchingLineItem {
  id?: string;
  description: string;
  catalogNumber?: string | null;
  quantity: NumericValue;
  unit?: string | null;
  unitPrice?: NumericValue | null;
  totalPrice?: NumericValue | null;
  sortOrder?: number;
  quantityBreakdown?: { value: NumericValue; [key: string]: unknown }[] | null;
  /** Injected at call site for invoice items to track which invoice they came from */
  __sourceInvIdx?: number;
}

/** A line item paired with its original array index */
export interface IndexedLineItem {
  item: MatchingLineItem;
  i: number;
}

/** A line item paired with its original array index (alternate key name used in catalog matching) */
export interface IndexedLineItemRef {
  item: MatchingLineItem;
  idx: number;
}

/** An entry in the item map that groups matched line items across document types */
export interface ItemMapEntry {
  po?: MatchingLineItem;
  dn?: MatchingLineItem;
  inv?: MatchingLineItem;
}

/** Shape of a pairing item inside LineItemPairing (output of toPairingItem) */
export interface PairingItem {
  id?: string;
  description: string;
  catalogNumber?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  index: number;
  invoiceIdx?: number;
}

export interface LineItemPairing {
  matchSource: 'catalog' | 'ai' | 'ai_second_round' | 'feedback' | 'description' | 'relaxed';
  po?: PairingItem;
  dn?: PairingItem;
  inv?: PairingItem;
}

export interface MatchItemsResult {
  itemMap: Map<string, ItemMapEntry>;
  pairings: LineItemPairing[];
}

export interface AutoMatchContext {
  companyId: string;
  /** The company's own name — used to prevent treating the company itself as a sub-supplier */
  companyName: string | null;
  unmatchedPOs: any[];
  unmatchedDNs: any[];
  unmatchedInvoices: any[];
  matchedPOSet: Set<string>;
  matchedDNSet: Set<string>;
  matchedInvSet: Set<string>;
  created: string[];
  updatedMatchIds: Set<string>;
  /** Pre-loaded existing matches — shared across consolidation steps to avoid repeated full-table queries */
  cachedMatches?: any[];
  /** Pre-loaded suppliers with aliases — shared across consolidation + supplier matching steps */
  cachedSuppliers?: { id: string; name: string; aliases: string[] }[];
  /** Pre-built alias index from cachedSuppliers */
  cachedAliasIndex?: Map<string, string>;
}
