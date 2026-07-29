export interface TestCaseMeta {
  id: string;
  name: string;
  description: string;
  tags: string[];
  documents: Array<{
    fileName: string;
    type: 'purchase_order' | 'delivery_note' | 'invoice';
  }>;
  hasMocks: boolean;
  createdAt: string;
}

export interface AssertionResult {
  name: string;
  expected: any;
  actual: any;
  passed: boolean;
  category: 'quantity' | 'matching' | 'status' | 'amount' | 'duplicate';
}

export interface TestRunResult {
  runId: string;
  caseId: string;
  caseName: string;
  mode: 'live' | 'mock';
  status: 'passed' | 'failed' | 'error';
  startedAt: string;
  completedAt: string;
  duration: number;
  assertions: AssertionResult[];
  error?: string;
}

export interface TestCaseSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  hasMocks: boolean;
  documentCount: number;
  lastRun?: {
    status: 'passed' | 'failed' | 'error';
    mode: 'live' | 'mock';
    completedAt: string;
    passedCount: number;
    failedCount: number;
  };
}

export interface TestAssertions {
  lineItems: Array<{
    description: string;
    orderedQty: number;
    receivedQty: number;
    invoicedAmount?: number;
    deliveryStatus: 'full' | 'partial' | 'over' | 'none';
    invoicedStatus?: 'matched' | 'mismatch' | 'pending' | 'service';
  }>;
  duplicates?: Array<{
    description: string;
    expectedCount: number;
    totalReceivedQty: number;
  }>;
  match?: {
    hasDiscrepancies: boolean;
    documentCount: {
      pos: number;
      dns: number;
      invoices: number;
    };
  };
}
