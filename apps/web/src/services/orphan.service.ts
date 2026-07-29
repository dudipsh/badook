import type { OrphanedDoc, OrphanReason } from '../types/orphan';
import type { OrphanDocuments } from './projects.service';
import { projectsService } from './projects.service';

function inferDnReason(dn: OrphanDocuments['deliveryNotes'][number]): OrphanReason {
  if (dn.status === 'PARSE_FAILED' || (dn.parsingConfidence != null && dn.parsingConfidence < 0.5)) {
    return 'PARSING_ERROR';
  }
  if (!dn.supplierId && (!dn.supplierName || dn.supplierName.includes('Unknown'))) {
    return 'UNKNOWN_VENDOR';
  }
  return 'MISSING_PROJECT';
}

function inferDocReason(doc: { supplierId: string | null; supplierName: string }): OrphanReason {
  if (!doc.supplierId && (!doc.supplierName || doc.supplierName.includes('Unknown'))) {
    return 'UNKNOWN_VENDOR';
  }
  return 'MISSING_PROJECT';
}

function mapLineItems(items: OrphanDocuments['deliveryNotes'][number]['lineItems']): OrphanedDoc['lineItems'] {
  return items.map(({ sortOrder: _, ...rest }) => rest);
}

function flatten(data: OrphanDocuments): OrphanedDoc[] {
  const docs: OrphanedDoc[] = [];

  for (const dn of data.deliveryNotes) {
    docs.push({
      id: dn.id, docType: 'deliveryNote', docNumber: dn.noteNumber,
      supplierName: dn.supplierName, date: dn.deliveryDate,
      totalAmount: dn.totalAmount, vatAmount: dn.vatAmount,
      originalFileUrl: dn.originalFileUrl,
      createdAt: dn.createdAt, reason: inferDnReason(dn),
      lineItems: mapLineItems(dn.lineItems),
      senderEmail: dn.emailScanLog?.senderEmail,
      senderName: dn.emailScanLog?.senderName,
    });
  }
  for (const po of data.purchaseOrders) {
    docs.push({
      id: po.id, docType: 'purchaseOrder', docNumber: po.poNumber,
      supplierName: po.supplierName, date: po.orderDate,
      totalAmount: po.totalAmount, vatAmount: null,
      originalFileUrl: po.originalFileUrl,
      createdAt: po.createdAt, reason: 'MISSING_PO',
      lineItems: mapLineItems(po.lineItems),
    });
  }
  for (const inv of data.invoices) {
    docs.push({
      id: inv.id, docType: 'invoice', docNumber: inv.invoiceNumber,
      supplierName: inv.supplierName, date: inv.invoiceDate,
      totalAmount: inv.totalAmount, vatAmount: inv.vatAmount,
      originalFileUrl: inv.originalFileUrl,
      createdAt: inv.createdAt, reason: inferDocReason(inv),
      lineItems: mapLineItems(inv.lineItems),
    });
  }

  return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const orphanService = {
  async fetchOrphanedDocs(): Promise<OrphanedDoc[]> {
    const data = await projectsService.getOrphanDocuments();
    return flatten(data);
  },

  async assignToProject(projectId: string, doc: OrphanedDoc): Promise<void> {
    await projectsService.linkDocuments(projectId, [{ id: doc.id, type: doc.docType }]);
  },

  async deleteDoc(doc: OrphanedDoc): Promise<void> {
    await projectsService.deleteOrphanDocument(doc.id, doc.docType);
  },
};
