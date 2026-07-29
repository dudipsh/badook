export interface LineItemPairing {
  matchSource: 'catalog' | 'ai' | 'feedback' | 'description';
  po?: { description: string; catalogNumber?: string; quantity: number; index: number };
  dn?: { description: string; catalogNumber?: string; quantity: number; index: number };
  inv?: { description: string; catalogNumber?: string; quantity: number; index: number };
}

export interface Discrepancy {
  field: string;
  description: string;
  poValue: string | null;
  dnValue: string | null;
  invValue: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface ThreeWayMatch {
  id: string;
  companyId: string;
  purchaseOrderId: string | null;
  status: string;
  discrepancies: Discrepancy[] | null;
  lineItemPairings: LineItemPairing[] | null;
  matchedAt: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemMatchFeedback {
  id: string;
  companyId: string;
  descriptionA: string;
  descriptionB: string;
  catalogNumberA: string | null;
  catalogNumberB: string | null;
  sourceDocType: string;
  targetDocType: string;
  threeWayMatchId: string | null;
  feedbackType: string;
  pairingIndex: number | null;
  createdById: string;
  createdAt: string;
}
