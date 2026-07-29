import { makeAutoObservable, runInAction } from 'mobx';
import { projectsService, type Project, type OrphanDocuments } from '../services/projects.service';
import { suppliersService } from '../services/suppliers.service';
import type {
  ProjectStats,
  ProjectVendor,
  ReconciliationLineItem,
  VendorPurchaseOrder,
  EditLineItemPayload,
  LineItemAuditEntry,
  GroupByValue,
} from '../types/reconciliation';

export class ProjectDashboardStore {
  projectId: string | null = null;
  project: Project | null = null;
  stats: ProjectStats | null = null;
  loading = false;

  vendors: ProjectVendor[] = [];
  vendorsLoading = false;
  selectedVendorId: string | null = null;
  vendorSearch = '';

  lineItems: ReconciliationLineItem[] = [];
  lineItemsLoading = false;

  vendorPOs: VendorPurchaseOrder[] = [];
  selectedPoId: string | null = null;
  statusFilter: 'all' | 'mismatches' | 'matched' | 'pending' = 'all';
  groupBy: GroupByValue = 'orders';
  dateFrom: string | null = null;
  dateTo: string | null = null;

  selectedLineItemForReview: ReconciliationLineItem | null = null;
  documentViewerFilePath: string | null = null;

  editingLineItem: ReconciliationLineItem | null = null;
  editDefaultReason: string | null = null;
  editSaving = false;

  deletingLineItem: ReconciliationLineItem | null = null;
  deleteConfirmMode: 'line' | 'document' | null = null;
  deleteInProgress = false;
  auditTrail: Map<string, LineItemAuditEntry[]> = new Map();
  auditTrailLoading: Set<string> = new Set();

  orphanModalOpen = false;
  orphanDocuments: OrphanDocuments | null = null;
  orphanLoading = false;
  orphanLinking = false;
  orphanSelectedIds: Set<string> = new Set();
  orphanActiveTab: 'deliveryNotes' | 'purchaseOrders' | 'invoices' = 'deliveryNotes';

  matching = false;
  _reloadingAfterMatch = false;

  sidebarCollapsed = false;
  isTableExpanded = false;
  docSearch = '';
  evidenceItem: ReconciliationLineItem | null = null;
  selectedDetailItem: ReconciliationLineItem | null = null;
  highlightedDocId: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  setSidebarCollapsed(collapsed: boolean) {
    this.sidebarCollapsed = collapsed;
  }

  openEvidence(item: ReconciliationLineItem) {
    this.selectedDetailItem = null;
    this.evidenceItem = item;
  }

  closeEvidence() {
    this.evidenceItem = null;
  }

  openDetailDrawer(item: ReconciliationLineItem) {
    this.selectedDetailItem = item;
  }

  closeDetailDrawer() {
    this.selectedDetailItem = null;
  }

  get filteredVendors(): ProjectVendor[] {
    if (!this.vendorSearch) return this.vendors;
    const q = this.vendorSearch.toLowerCase();
    return this.vendors.filter((v) => v.name.toLowerCase().includes(q));
  }

  get filteredLineItems(): ReconciliationLineItem[] {
    if (!this.docSearch) return this.lineItems;
    const q = this.docSearch.toLowerCase();
    return this.lineItems.filter((item) => {
      const textFields = [
        item.description,
        item.poNumber,
        item.catalogNumber,
        item.dnNoteNumber,
        item.invoiceNumber,
        item.unit,
        item.mismatchReason,
        item.quoteReference,
      ];
      if (textFields.some((f) => f?.toLowerCase().includes(q))) return true;
      const numFields = [
        item.orderedQty,
        item.receivedQty,
        item.unitPrice,
        item.lineTotal,
        item.remaining,
        item.quantity,
        item.totalPrice,
        item.invoicedAmount,
        item.invoicedUnitPrice,
      ];
      return numFields.some((n) => n != null && String(n).includes(q));
    });
  }

  get totalLineItemCount(): number {
    return this.lineItems.length;
  }

  async loadProject(id: string) {
    if (this.projectId === id && this.project) return;
    this.loading = true;
    this.projectId = id;
    try {
      const [project, stats] = await Promise.all([
        projectsService.getOne(id),
        projectsService.getStats(id),
      ]);
      runInAction(() => {
        this.project = project;
        this.stats = stats;
      });
      // Fire-and-forget: check if new documents need reconciliation
      projectsService.checkReconciliation(id).then((res) => {
        if (res.needsReconciliation) {
          runInAction(() => { this.matching = true; });
          // Safety timeout: clear spinner if socket event never arrives
          setTimeout(() => {
            runInAction(() => { this.matching = false; });
          }, 30_000);
        }
      }).catch(() => {});
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async loadVendors(projectId: string) {
    this.vendorsLoading = true;
    this.selectedVendorId = null;
    this.lineItems = [];
    this.vendorPOs = [];
    try {
      const vendors = await projectsService.getVendors(projectId);
      runInAction(() => {
        this.vendors = vendors;
        if (vendors.length > 0) {
          this.selectedVendorId = vendors[0].id;
        }
      });
    } finally {
      runInAction(() => {
        this.vendorsLoading = false;
      });
    }
  }

  async selectVendor(vendorId: string) {
    this.selectedVendorId = vendorId;
    this.selectedPoId = null;
    this.statusFilter = 'all';
    if (this.projectId) {
      await Promise.all([
        this.loadLineItems(),
        this.loadVendorPOs(),
      ]);
    }
  }

  async loadVendorPOs() {
    if (!this.projectId || !this.selectedVendorId) return;
    try {
      const pos = await projectsService.getVendorPurchaseOrders(this.projectId, this.selectedVendorId);
      runInAction(() => {
        this.vendorPOs = pos;
        // When the current tab has no documents for this vendor, jump to the first tab that
        // does (orders → delivery notes → invoices). Selecting a vendor should never land on
        // an empty view — e.g. a vendor with only invoices opens straight on the invoices tab.
        const vendor = this.vendors.find((v) => v.id === this.selectedVendorId);
        const countFor = (tab: GroupByValue): number =>
          tab === 'orders' ? pos.length
            : tab === 'deliveryNotes' ? (vendor?.deliveryNoteCount ?? 0)
              : tab === 'invoices' ? (vendor?.invoiceCount ?? 0)
                : 0;
        if (this.groupBy !== 'all' && countFor(this.groupBy) === 0) {
          const firstWithData = (['orders', 'deliveryNotes', 'invoices'] as GroupByValue[])
            .find((tab) => countFor(tab) > 0);
          if (firstWithData && firstWithData !== this.groupBy) {
            this.groupBy = firstWithData;
            this.loadLineItems();
          }
        }
      });
    } catch {
      // silently fail
    }
  }

  async loadLineItems() {
    if (!this.projectId || !this.selectedVendorId) return;
    this.lineItemsLoading = true;
    try {
      const filters: { poId?: string; status?: string; groupBy?: string; dateFrom?: string; dateTo?: string } = {};
      if (this.selectedPoId) filters.poId = this.selectedPoId;
      if (this.statusFilter !== 'all') filters.status = this.statusFilter;
      if (this.groupBy !== 'orders' && this.groupBy !== 'all') filters.groupBy = this.groupBy;
      if (this.dateFrom) filters.dateFrom = this.dateFrom;
      if (this.dateTo) filters.dateTo = this.dateTo;
      const items = await projectsService.getVendorLineItems(
        this.projectId,
        this.selectedVendorId,
        filters,
      );
      runInAction(() => {
        this.lineItems = items;
      });
    } finally {
      runInAction(() => {
        this.lineItemsLoading = false;
      });
    }
  }

  setPoFilter(poId: string | null) {
    this.selectedPoId = poId;
    this.loadLineItems();
  }

  setStatusFilter(status: 'all' | 'mismatches' | 'matched' | 'pending') {
    this.statusFilter = status;
    this.loadLineItems();
  }

  setGroupBy(value: GroupByValue) {
    this.groupBy = value;
    this.loadLineItems();
  }

  setDateFrom(date: string | null) {
    this.dateFrom = date;
    this.loadLineItems();
  }

  setDateTo(date: string | null) {
    this.dateTo = date;
    this.loadLineItems();
  }

  setHighlightedDocId(docId: string | null) {
    this.highlightedDocId = docId;
  }

  switchToDoc(docId: string, groupBy: GroupByValue) {
    this.groupBy = groupBy;
    this.highlightedDocId = docId;
    this.loadLineItems();
  }

  setVendorSearch(search: string) {
    this.vendorSearch = search;
  }

  toggleTableExpanded() {
    this.isTableExpanded = !this.isTableExpanded;
  }

  setDocSearch(term: string) {
    this.docSearch = term;
  }

  openReview(lineItem: ReconciliationLineItem) {
    this.selectedLineItemForReview = lineItem;
  }

  closeReview() {
    this.selectedLineItemForReview = null;
  }

  openDocument(filePath: string) {
    this.documentViewerFilePath = filePath;
  }

  closeDocument() {
    this.documentViewerFilePath = null;
  }

  openEdit(lineItem: ReconciliationLineItem, defaultReason?: string) {
    this.editingLineItem = lineItem;
    this.editDefaultReason = defaultReason ?? null;
  }

  closeEdit() {
    this.editingLineItem = null;
    this.editDefaultReason = null;
  }

  openDelete(lineItem: ReconciliationLineItem) {
    this.deletingLineItem = lineItem;
    this.deleteConfirmMode = null;
  }

  closeDelete() {
    this.deletingLineItem = null;
    this.deleteConfirmMode = null;
  }

  requestDeleteConfirm(mode: 'line' | 'document') {
    this.deleteConfirmMode = mode;
  }

  cancelDeleteConfirm() {
    this.deleteConfirmMode = null;
  }

  async confirmDelete() {
    if (!this.deletingLineItem || !this.deleteConfirmMode) return;
    this.deleteInProgress = true;
    try {
      if (this.deleteConfirmMode === 'line') {
        const docType = this.getDeleteDocType();
        await projectsService.deleteLineItem(this.deletingLineItem.id, docType);
      } else {
        const { documentId, documentType } = this.getDeleteDocumentInfo();
        await projectsService.removeDocument(documentId, documentType);
      }
      runInAction(() => {
        this.deletingLineItem = null;
        this.deleteConfirmMode = null;
      });
      await Promise.all([
        this.loadLineItems(),
        this.projectId ? projectsService.getStats(this.projectId).then((stats) => {
          runInAction(() => { this.stats = stats; });
        }) : Promise.resolve(),
      ]);
    } finally {
      runInAction(() => {
        this.deleteInProgress = false;
      });
    }
  }

  private getDeleteDocType(): 'dn' | 'invoice' {
    if (this.groupBy === 'invoices') return 'invoice';
    return 'dn';
  }

  private getDeleteDocumentInfo(): { documentId: string; documentType: 'deliveryNote' | 'invoice' } {
    const item = this.deletingLineItem!;
    if (this.groupBy === 'invoices') {
      return { documentId: item.invoiceId!, documentType: 'invoice' };
    }
    return { documentId: item.dnId!, documentType: 'deliveryNote' };
  }

  async saveLineItemEdit(payload: EditLineItemPayload) {
    if (!this.editingLineItem) return;
    this.editSaving = true;
    const lineItemId = this.editingLineItem.id;
    try {
      await projectsService.editLineItem(lineItemId, payload);
      runInAction(() => {
        this.auditTrail.delete(lineItemId);
        this.editingLineItem = null;
      });
      await this.loadLineItems();
    } finally {
      runInAction(() => {
        this.editSaving = false;
      });
    }
  }

  async resolveException(lineItemId: string, type: string) {
    await projectsService.resolveException(lineItemId, type);
    this.auditTrail.delete(lineItemId);
    await this.loadLineItems();
  }

  async loadAuditTrail(lineItemId: string) {
    if (this.auditTrail.has(lineItemId)) return;
    this.auditTrailLoading = new Set([...this.auditTrailLoading, lineItemId]);
    try {
      const trail = await projectsService.getLineItemAuditTrail(lineItemId);
      runInAction(() => {
        this.auditTrail.set(lineItemId, trail);
        const next = new Set(this.auditTrailLoading);
        next.delete(lineItemId);
        this.auditTrailLoading = next;
      });
    } catch {
      runInAction(() => {
        const next = new Set(this.auditTrailLoading);
        next.delete(lineItemId);
        this.auditTrailLoading = next;
      });
    }
  }

  async deleteVendor(vendorId: string) {
    await suppliersService.delete(vendorId);
    if (this.projectId) await this.loadVendors(this.projectId);
  }

  async mergeVendor(targetId: string, sourceId: string) {
    this.matching = true;
    try {
      await suppliersService.merge(targetId, sourceId);
      if (this.projectId) {
        await Promise.all([
          this.loadProject(this.projectId),
          this.loadVendors(this.projectId),
        ]);
      }
    } finally {
      this.matching = false;
    }
  }

  async openOrphanModal() {
    this.orphanModalOpen = true;
    this.orphanLoading = true;
    this.orphanSelectedIds = new Set();
    this.orphanActiveTab = 'deliveryNotes';
    try {
      const docs = await projectsService.getOrphanDocuments();
      runInAction(() => {
        this.orphanDocuments = docs;
      });
    } catch (err) {
      console.error('Failed to load orphan documents:', err);
    } finally {
      runInAction(() => {
        this.orphanLoading = false;
      });
    }
  }

  closeOrphanModal() {
    this.orphanModalOpen = false;
    this.orphanDocuments = null;
    this.orphanSelectedIds = new Set();
  }

  setOrphanTab(tab: 'deliveryNotes' | 'purchaseOrders' | 'invoices') {
    this.orphanActiveTab = tab;
    this.orphanSelectedIds = new Set();
  }

  toggleOrphanSelection(id: string) {
    const newSet = new Set(this.orphanSelectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    this.orphanSelectedIds = newSet;
  }

  get orphanSelectedCount(): number {
    return this.orphanSelectedIds.size;
  }

  async linkSelectedDocuments() {
    if (!this.projectId || this.orphanSelectedIds.size === 0) return;
    this.orphanLinking = true;
    try {
      const typeMap = {
        deliveryNotes: 'deliveryNote' as const,
        purchaseOrders: 'purchaseOrder' as const,
        invoices: 'invoice' as const,
      };
      const documents = Array.from(this.orphanSelectedIds).map((id) => ({
        id,
        type: typeMap[this.orphanActiveTab],
      }));
      await projectsService.linkDocuments(this.projectId, documents);
      runInAction(() => {
        this.orphanModalOpen = false;
        this.orphanDocuments = null;
        this.orphanSelectedIds = new Set();
        this.project = null;
      });
      await Promise.all([
        this.loadProject(this.projectId!),
        this.loadVendors(this.projectId!),
      ]);
    } finally {
      runInAction(() => {
        this.orphanLinking = false;
      });
    }
  }

  async deleteOrphanDocument(docId: string, docType: 'deliveryNotes' | 'purchaseOrders' | 'invoices') {
    const typeMap = {
      deliveryNotes: 'deliveryNote' as const,
      purchaseOrders: 'purchaseOrder' as const,
      invoices: 'invoice' as const,
    };
    await projectsService.deleteOrphanDocument(docId, typeMap[docType]);
    // Refresh orphan documents list
    if (this.orphanDocuments) {
      runInAction(() => {
        const list = this.orphanDocuments![docType] as any[];
        this.orphanDocuments = {
          ...this.orphanDocuments!,
          [docType]: list.filter((d: any) => d.id !== docId),
        };
        this.orphanSelectedIds.delete(docId);
      });
    }
  }

  setMatching(matching: boolean) {
    this.matching = matching;
  }

  async onMatchingComplete() {
    this.matching = false;
    this._reloadingAfterMatch = true;
    try {
      if (this.projectId) {
        this.project = null; // force reload
        await Promise.all([
          this.loadProject(this.projectId),
          this.loadVendors(this.projectId),
        ]);
        // Reload line items + stats after vendors are loaded to get fresh match data
        if (this.selectedVendorId) {
          await this.loadLineItems();
        }
        // Re-fetch stats after line items are loaded (stats depend on line item matching)
        const freshStats = await projectsService.getStats(this.projectId);
        runInAction(() => { this.stats = freshStats; });
      }
    } finally {
      runInAction(() => { this._reloadingAfterMatch = false; });
    }
  }

  /**
   * Invalidate cached project data so next navigation fetches fresh data.
   * If the user is currently viewing this project, reload immediately.
   */
  invalidateAndReload(projectId?: string) {
    // If a specific project ID is given and it's not the one we're viewing, ignore
    if (projectId && this.projectId && projectId !== this.projectId) return;
    // Don't clobber stats while onMatchingComplete is reloading
    if (this._reloadingAfterMatch) return;

    this.project = null;
    this.stats = null;

    // If we're currently viewing this project, reload immediately
    if (this.projectId) {
      Promise.all([
        this.loadProject(this.projectId),
        this.loadVendors(this.projectId),
      ]);
    }
  }

  reset() {
    this.projectId = null;
    this.project = null;
    this.stats = null;
    this.vendors = [];
    this.selectedVendorId = null;
    this.vendorSearch = '';
    this.lineItems = [];
    this.vendorPOs = [];
    this.selectedPoId = null;
    this.statusFilter = 'all';
    this.groupBy = 'orders';
    this.dateFrom = null;
    this.dateTo = null;
    this.selectedLineItemForReview = null;
    this.documentViewerFilePath = null;
    this.editingLineItem = null;
    this.editSaving = false;
    this.deletingLineItem = null;
    this.deleteConfirmMode = null;
    this.deleteInProgress = false;
    this.auditTrail = new Map();
    this.auditTrailLoading = new Set();
    this.orphanModalOpen = false;
    this.orphanDocuments = null;
    this.orphanLoading = false;
    this.orphanLinking = false;
    this.orphanSelectedIds = new Set();
    this.orphanActiveTab = 'deliveryNotes';
    this.sidebarCollapsed = false;
    this.isTableExpanded = false;
    this.docSearch = '';
    this.evidenceItem = null;
    this.selectedDetailItem = null;
    this.highlightedDocId = null;
  }
}
