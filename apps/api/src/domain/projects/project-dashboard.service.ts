import { Injectable, Logger } from '@nestjs/common';
import { ProjectStatsService } from './project-stats.service';
import { VendorLineItemsService } from './vendor-line-items.service';
import { ProjectDocumentsService } from './project-documents.service';
import { LineItemEditService } from './line-item-edit.service';
import { MatchingService } from '../matching/matching.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JobsGateway } from '../../infrastructure/jobs/jobs.gateway';
import type { EditLineItemDto } from './dto/edit-line-item.dto';
import type { ExceptionActionDto } from './dto/exception-action.dto';

@Injectable()
export class ProjectDashboardService {
  private readonly logger = new Logger(ProjectDashboardService.name);
  private readonly reconciliationInProgress = new Set<string>();

  constructor(
    private readonly stats: ProjectStatsService,
    private readonly vendorLineItems: VendorLineItemsService,
    private readonly documents: ProjectDocumentsService,
    private readonly lineItemEdit: LineItemEditService,
    private readonly matchingService: MatchingService,
    private readonly prisma: PrismaService,
    private readonly gateway: JobsGateway,
  ) {}

  // --- Group A: Stats ---
  getProjectStats(id: string, companyId?: string) {
    return this.stats.getProjectStats(id, companyId);
  }

  getProjectVendors(id: string, companyId?: string) {
    return this.stats.getProjectVendors(id, companyId);
  }

  getVendorPurchaseOrders(projectId: string, vendorId: string, companyId?: string) {
    return this.stats.getVendorPurchaseOrders(projectId, vendorId, companyId);
  }

  // --- Group B: Vendor Line Items ---
  getVendorLineItems(projectId: string, vendorId: string, filters: { poId?: string; status?: string; groupBy?: 'orders' | 'deliveryNotes' | 'invoices'; dateFrom?: string; dateTo?: string }, companyId?: string) {
    return this.vendorLineItems.getVendorLineItems(projectId, vendorId, filters, companyId);
  }

  // --- Group C: Documents ---
  getDeliveryNotes(id: string, companyId?: string) {
    return this.documents.getDeliveryNotes(id, companyId);
  }

  getFullDetails(id: string, companyId?: string) {
    return this.documents.getFullDetails(id, companyId);
  }

  getOrphanDocuments(companyId: string) {
    return this.documents.getOrphanDocuments(companyId);
  }

  deleteOrphanDocument(companyId: string, documentId: string, documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice') {
    return this.documents.deleteOrphanDocument(companyId, documentId, documentType);
  }

  linkDocuments(projectId: string, dto: { documents: Array<{ type: string; id: string }> }, companyId?: string) {
    return this.documents.linkDocuments(projectId, dto, companyId);
  }

  // --- Group D: Line Item Edits ---
  editLineItem(poLineItemId: string, dto: EditLineItemDto, userId: string, companyId: string) {
    return this.lineItemEdit.editLineItem(poLineItemId, dto, userId, companyId);
  }

  getLineItemAuditTrail(poLineItemId: string, companyId?: string) {
    return this.lineItemEdit.getLineItemAuditTrail(poLineItemId, companyId);
  }

  resolveException(poLineItemId: string, dto: ExceptionActionDto, userId: string, companyId: string) {
    return this.lineItemEdit.resolveException(poLineItemId, dto, userId, companyId);
  }

  getProjectQuotes(projectId: string, companyId?: string) {
    return this.lineItemEdit.getProjectQuotes(projectId, companyId);
  }

  deleteLineItem(lineItemId: string, documentType: 'dn' | 'invoice', companyId: string) {
    return this.lineItemEdit.deleteLineItem(lineItemId, documentType, companyId);
  }

  removeDocument(companyId: string, documentId: string, documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice') {
    return this.matchingService.removeDocument(companyId, documentId, documentType);
  }

  async updateDocument(
    companyId: string,
    documentId: string,
    documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice',
    data: {
      supplierName?: string;
      docNumber?: string;
      date?: string;
      totalAmount?: number;
      lineItems?: { description: string; catalogNumber: string; unit: string; quantity: string; unitPrice: string; discountPercent: string }[];
    },
  ) {
    const buildData = (nameField: string, numberField: string, dateField: string) => ({
      ...(data.supplierName !== undefined && { [nameField]: data.supplierName }),
      ...(data.docNumber !== undefined && { [numberField]: data.docNumber }),
      ...(data.date !== undefined && { [dateField]: new Date(data.date) }),
      ...(data.totalAmount !== undefined && { totalAmount: data.totalAmount }),
    });

    const mapLineItem = (li: { description: string; catalogNumber: string; unit: string; quantity: string; unitPrice: string; discountPercent: string }, idx: number) => {
      const qty = parseFloat(li.quantity) || 0;
      const price = parseFloat(li.unitPrice) || 0;
      const disc = parseFloat(li.discountPercent) || 0;
      const total = qty * price * (1 - disc / 100);
      return {
        description: li.description,
        catalogNumber: li.catalogNumber || null,
        unit: li.unit || null,
        quantity: qty,
        unitPrice: price,
        totalPrice: total,
        discountPercent: disc || null,
        sortOrder: idx,
      };
    };

    if (documentType === 'deliveryNote') {
      return this.prisma.$transaction(async (tx) => {
        if (data.lineItems?.length) {
          await tx.lineItem.deleteMany({ where: { deliveryNoteId: documentId } });
          await tx.lineItem.createMany({ data: data.lineItems.map((li, i) => ({ deliveryNoteId: documentId, ...mapLineItem(li, i) })) });
        }
        return tx.deliveryNote.update({
          where: { id: documentId, companyId },
          data: { ...buildData('supplierName', 'noteNumber', 'deliveryDate'), needsReconciliation: true },
        });
      });
    } else if (documentType === 'purchaseOrder') {
      return this.prisma.$transaction(async (tx) => {
        if (data.lineItems?.length) {
          await tx.pOLineItem.deleteMany({ where: { purchaseOrderId: documentId } });
          await tx.pOLineItem.createMany({ data: data.lineItems.map((li, i) => ({ purchaseOrderId: documentId, ...mapLineItem(li, i) })) });
        }
        return tx.purchaseOrder.update({
          where: { id: documentId, companyId },
          data: { ...buildData('supplierName', 'poNumber', 'orderDate'), needsReconciliation: true },
        });
      });
    } else {
      return this.prisma.$transaction(async (tx) => {
        if (data.lineItems?.length) {
          await tx.invoiceLineItem.deleteMany({ where: { invoiceId: documentId } });
          await tx.invoiceLineItem.createMany({ data: data.lineItems.map((li, i) => ({ invoiceId: documentId, ...mapLineItem(li, i) })) });
        }
        return tx.invoice.update({
          where: { id: documentId, companyId },
          data: { ...buildData('supplierName', 'invoiceNumber', 'invoiceDate'), needsReconciliation: true },
        });
      });
    }
  }

  // --- Group E: Lazy Reconciliation ---
  async checkAndTriggerReconciliation(projectId: string, companyId: string) {
    const needs = await this.stats.checkNeedsReconciliation(projectId);
    if (!needs) return { needsReconciliation: false };

    if (this.reconciliationInProgress.has(projectId)) {
      return { needsReconciliation: true };
    }

    this.reconciliationInProgress.add(projectId);
    this.runReconciliation(projectId, companyId).finally(() =>
      this.reconciliationInProgress.delete(projectId),
    );

    return { needsReconciliation: true };
  }

  private async runReconciliation(projectId: string, companyId: string) {
    this.gateway.emitMatchingStarted(companyId, projectId);
    try {
      const result = await this.matchingService.autoMatch(companyId, { projectId });
      await Promise.all([
        this.prisma.deliveryNote.updateMany({
          where: { projectId, needsReconciliation: true },
          data: { needsReconciliation: false },
        }),
        this.prisma.purchaseOrder.updateMany({
          where: { projectId, needsReconciliation: true },
          data: { needsReconciliation: false },
        }),
        this.prisma.invoice.updateMany({
          where: { projectId, needsReconciliation: true },
          data: { needsReconciliation: false },
        }),
      ]);
      this.gateway.emitMatchingComplete(companyId, projectId, result.matchesCreated);
      this.gateway.emitDataChanged(companyId, 'project', { id: projectId });
    } catch (e) {
      this.logger.warn(`Reconciliation failed for project ${projectId}: ${e}`);
      this.gateway.emitMatchingComplete(companyId, projectId);
    }
  }
}
