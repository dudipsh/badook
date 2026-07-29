import { IsArray, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsObject()
  scope?: ChatMessageScope;
}

export interface ChatMessageScope {
  projectId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ChatStreamChunkEvent {
  type: 'chunk';
  content: string;
}

export interface ChatStreamCardEvent {
  type: 'card';
  card: ChatCard;
}

export interface ChatStreamDoneEvent {
  type: 'done';
  messageId: string;
  title?: string;
}

export interface ChatStreamErrorEvent {
  type: 'error';
  message: string;
}

export type ChatStreamEvent =
  | ChatStreamChunkEvent
  | ChatStreamCardEvent
  | ChatStreamDoneEvent
  | ChatStreamErrorEvent;

/**
 * Rich cards surfaced from tool results during a streamed reply.
 * They are ephemeral (not persisted) — rendered alongside the assistant text.
 */
export type ChatCardKind =
  | 'company_overview'
  | 'project_summary'
  | 'project_list'
  | 'supplier_list'
  | 'discrepancy_list'
  | 'item_supply_summary'
  | 'item_documents';

export interface CompanyOverviewCardData {
  projectCount: number;
  supplierCount: number;
  deliveryNoteCount: number;
  purchaseOrderCount: number;
  invoiceCount: number;
  matchedCount: number;
  unmatchedOrPartialCount: number;
}

export interface ProjectSummaryCardData {
  id: string;
  name: string;
  address: string | null;
  isArchived: boolean;
  deliveryNoteCount: number;
  purchaseOrderCount: number;
  invoiceCount: number;
  totalInvoiceAmountIls: number;
  totalPurchaseOrderAmountIls: number;
  matchSummary: Record<string, number>;
  matchRate: number | null;
}

export interface ProjectListItem {
  id: string;
  name: string;
  address: string | null;
  isArchived: boolean;
  deliveryNoteCount: number;
  purchaseOrderCount: number;
  invoiceCount: number;
}

export interface ProjectListCardData {
  count: number;
  projects: ProjectListItem[];
}

export interface SupplierListItem {
  id: string;
  name: string;
  businessId: string | null;
  phone: string | null;
  email: string | null;
  deliveryNoteCount: number;
  purchaseOrderCount: number;
  invoiceCount: number;
}

export interface SupplierListCardData {
  count: number;
  suppliers: SupplierListItem[];
}

export interface DiscrepancyListItem {
  id: string;
  status: string;
  projectName: string | null;
  supplierName: string | null;
  poNumber: string | null;
  invoiceNumbers: string[];
  deliveryNoteNumbers: string[];
  totalInvoiceAmountIls: number;
  totalPoAmountIls: number;
  notes: string | null;
  createdAt: string;
}

export interface DiscrepancyListCardData {
  count: number;
  discrepancies: DiscrepancyListItem[];
}

export interface ItemSupplyBreakdownRow {
  key: string;
  label: string;
  id: string | null;
  totalQuantity: number;
  totalSpend: number;
  documentCount: number;
}

export interface ItemSupplySource {
  type: 'invoice' | 'delivery_note' | 'purchase_order';
  number: string | null;
  docId: string | null;
}

export interface ItemSupplierBreakdownRow {
  key: string;
  label: string;
  totalQuantity: number;
  avgUnitPrice: number | null;
  totalSpend: number;
  sharePct: number;
  supplierId: string | null;
  firstDate: string | null;
  lastDate: string | null;
  source: ItemSupplySource | null;
}

export interface ItemSupplyLeadingSupplier {
  name: string;
  totalQuantity: number;
  totalSpend: number;
  sharePct: number;
}

export interface ItemSupplyPriceInsight {
  kind: 'stable' | 'variance';
  variancePct: number | null;
  supplierName: string | null;
  docNumber: string | null;
  outlierUnitPrice: number | null;
  avgUnitPrice: number | null;
  estBudgetImpact: number | null;
}

export interface ItemSupplySummaryCardData {
  itemQuery: string;
  docType: string;
  groupBy: string;
  itemCode: string | null;
  filters: {
    projectName: string | null;
    supplierName: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  matchedLineCount: number;
  documentCount: number;
  sourceDocCounts: { invoices: number; deliveryNotes: number };
  totalsByUnit: Array<{ unit: string; totalQuantity: number; lineCount: number }>;
  dominantUnit: string | null;
  price: {
    avgUnitPrice: number | null;
    minUnitPrice: number | null;
    maxUnitPrice: number | null;
    totalSpend: number;
  };
  leadingSupplier: ItemSupplyLeadingSupplier | null;
  supplierBreakdown: ItemSupplierBreakdownRow[];
  priceInsight: ItemSupplyPriceInsight | null;
  breakdown: ItemSupplyBreakdownRow[];
  sampleDescriptions: string[];
  truncated: boolean;
}

export interface ItemDocumentRow {
  type: 'invoice' | 'delivery_note' | 'purchase_order';
  docId: string;
  docNumber: string | null;
  docDate: string | null;
  projectId: string | null;
  projectName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  totalQuantity: number;
  unit: string | null;
  avgUnitPrice: number | null;
  lineTotal: number;
  lineCount: number;
}

export interface ItemDocumentsCardData {
  itemQuery: string;
  docType: string;
  filters: {
    projectName: string | null;
    supplierName: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  count: number;
  totalDocuments: number;
  documents: ItemDocumentRow[];
  truncated: boolean;
}

export type ChatCard =
  | { id: string; kind: 'company_overview'; data: CompanyOverviewCardData }
  | { id: string; kind: 'project_summary'; data: ProjectSummaryCardData }
  | { id: string; kind: 'project_list'; data: ProjectListCardData }
  | { id: string; kind: 'supplier_list'; data: SupplierListCardData }
  | { id: string; kind: 'discrepancy_list'; data: DiscrepancyListCardData }
  | { id: string; kind: 'item_supply_summary'; data: ItemSupplySummaryCardData }
  | { id: string; kind: 'item_documents'; data: ItemDocumentsCardData };
