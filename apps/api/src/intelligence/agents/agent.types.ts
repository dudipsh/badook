import type { DocumentType, ParsedDeliveryNote, ParsedInvoice, ParsedPurchaseOrder } from '../ocr/ocr.types';

export interface AgentContext {
  companyId: string;
  filePath: string;
  source: 'EMAIL' | 'MOBILE' | 'MANUAL';
  originalFileName?: string;
  sourceMetadata?: {
    senderEmail?: string;
    senderPhone?: string;
  };
  userId?: string;
  projectId?: string;
  force?: boolean;
  jobId?: string;
  emailScanLogId?: string;
  /** Pre-detected document type from detectDocumentsInFile — skips IntakeAgent when set */
  detectedType?: DocumentType;
  /** Context from multi-doc split — helps extraction prompts understand the document origin */
  splitContext?: string;
  /** When true, skip auto-match trigger (used for multi-segment files to avoid redundant runs) */
  skipAutoMatch?: boolean;
}

export type AgentStage = 'intake' | 'extraction' | 'verification' | 'matching' | 'saving';

export interface AgentProgressEvent {
  stage: AgentStage;
  status: 'running' | 'done' | 'failed';
  message?: string;
}

export interface IntakeResult {
  documentType: DocumentType;
  isValid: boolean;
  confidence: number;
  reason: string;
}

export interface ExtractionResult {
  documentType: DocumentType;
  supplierName: string;
  totalAmount: number | null;
  poReference: string | null;
  confidence: number;
  parsedData: ParsedDeliveryNote | ParsedInvoice | ParsedPurchaseOrder;
  /** Resolved supplier ID — populated when supplier is matched to a known entity */
  supplierId?: string;
}

export interface MatchingResult {
  projectId: string | null;
  matchMethod: 'po_reference' | 'dn_reference' | 'supplier' | 'manual' | 'auto_created' | 'address_match' | null;
  orphanReason?: 'UNKNOWN_PROJECT' | 'NO_PO_MATCH' | 'PROJECT_ARCHIVED' | 'PO_AWAITING_REVIEW';
}

export interface VerificationIssue {
  field: string;
  issue: 'supplier_customer_swap' | 'missing_items' | 'invented_name' | 'rounded_prices' | 'missing_units' | 'other';
  severity: 'error' | 'warning';
  description: string;
  suggestedCorrection?: string;
}

export interface VerificationResult {
  isValid: boolean;
  issues: VerificationIssue[];
  confidence: number;
  shouldReExtract: boolean;
  correctionInstructions?: string;
}

export interface AgentPipelineResult {
  success: boolean;
  status: 'COMPLETED' | 'ORPHANED' | 'INVALID' | 'DUPLICATE' | 'SKIPPED_PO';
  documentType: DocumentType;
  documentId?: string;
  projectId?: string;
  orphanReason?: string;
  error?: string;
}

export interface FileProcessingResult {
  processed: number;
  skipped: number;
  failed: number;
  errors: string[];
  documents: AgentPipelineResult[];
}
