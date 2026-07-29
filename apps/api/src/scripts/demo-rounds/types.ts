// apps/api/src/scripts/demo-rounds/types.ts
// Self-contained demo-document generator types. No Prisma/Nest imports.

export interface DemoItem {
  description: string; // canonical product name
  // Alternative names suppliers may use for the SAME product (same catalog
  // number). Lets the demo test whether intake recognizes one product
  // across differing descriptions.
  aliases?: string[];
  catalogNumber: string;
  unit: string;
  priceMin: number;
  priceMax: number;
}

export interface SupplierTheme {
  headerColor: [number, number, number]; // rgb 0..1
  accentColor: [number, number, number];
  layout: 'classic' | 'banded' | 'minimal';
}

export interface DemoSupplier {
  name: string;
  businessId: string;
  address: string;
  phone: string;
  docPrefix: string;
  pricesOnDeliveryNote: boolean;
  theme: SupplierTheme;
}

export interface DemoProject {
  name: string;
  address: string;
}

export interface DocLine {
  description: string; // the supplier's chosen name (may be an alias)
  catalogNumber: string; // stable key linking aliases to one product
  quantity: number;
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
}

export type DemoDocType = 'purchase_order' | 'delivery_note' | 'invoice';

export interface DemoDoc {
  type: DemoDocType;
  number: string;
  date: string; // YYYY-MM-DD
  supplier: DemoSupplier;
  project: DemoProject;
  poReference: string | null; // printed on DN/INV so matching links them
  lines: DocLine[];
  subtotal: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  fileName: string;
}

export type RoundScenario = 'clean' | 'split-delivery' | 'shortage' | 'overcharge';

export interface DemoRound {
  index: number;
  scenario: RoundScenario;
  supplier: DemoSupplier;
  project: DemoProject;
  po: DemoDoc;
  deliveryNotes: DemoDoc[];
  invoice: DemoDoc;
}

export interface DemoConfig {
  companyName: string;
  vatRate: number;
  seed: number;
  items: DemoItem[];
  suppliers: DemoSupplier[];
  projects: DemoProject[];
}
