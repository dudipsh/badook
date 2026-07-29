import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { VendorLineItemsService } from './vendor-line-items.service';
import { SuppliersService } from '../suppliers/suppliers.service';

@Injectable()
export class ProjectStatsService {
  private readonly logger = new Logger(ProjectStatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vendorLineItems: VendorLineItemsService,
    private readonly suppliersService: SuppliersService,
  ) {}

  private async ensureExists(id: string, companyId?: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (companyId && project.companyId !== companyId) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async getProjectStats(id: string, companyId?: string) {
    await this.ensureExists(id, companyId);

    const [purchaseOrders, invoices, deliveryNotes] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where: { projectId: id, isQuote: false },
        select: { id: true, totalAmount: true, currency: true },
      }),
      this.prisma.invoice.findMany({
        where: { projectId: id },
        select: { id: true, totalAmount: true },
      }),
      this.prisma.deliveryNote.findMany({
        where: { projectId: id },
        select: { id: true },
      }),
    ]);

    const currency = purchaseOrders.length > 0 ? (purchaseOrders[0].currency || 'ILS') : 'ILS';
    const invoiceAmount = invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);

    const hasPOs = purchaseOrders.length > 0;
    const hasDNs = deliveryNotes.length > 0;
    const hasInvoices = invoices.length > 0;

    // Dynamic reconciliation label based on which document types exist
    let reconciliationLabel = '';
    if (hasPOs && hasDNs && hasInvoices) {
      reconciliationLabel = 'הזמנות ↔ ת.משלוח ↔ חשבוניות';
    } else if (hasPOs && hasDNs) {
      reconciliationLabel = 'הזמנות ↔ תעודות משלוח';
    } else if (hasPOs && hasInvoices) {
      reconciliationLabel = 'הזמנות ↔ חשבוניות';
    } else {
      reconciliationLabel = 'ממתין למסמכים';
    }

    // Quantity-based reconciliation: compute from actual line item quantities
    let reconciliationPercentage = 0;
    if (hasPOs && (hasDNs || hasInvoices)) {
      reconciliationPercentage = await this.computeQuantityMatchPercentage(id);
    }

    return {
      reconciliationPercentage,
      reconciliationLabel,
      purchaseOrderCount: purchaseOrders.length,
      purchaseOrderAmount: purchaseOrders.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0),
      invoiceCount: invoices.length,
      invoiceAmount,
      deliveryCertCount: deliveryNotes.length,
      currency,
    };
  }

  /**
   * Compute quantity-based match percentage across all vendors in a project.
   * For each line item: min(receivedQty, orderedQty) / orderedQty
   * Aggregated across all non-service line items.
   */
  private async computeQuantityMatchPercentage(projectId: string): Promise<number> {
    const vendors = await this.getProjectVendors(projectId);
    let totalOrdered = 0;
    let totalFulfilled = 0;

    for (const vendor of vendors) {
      try {
        const lineItems = await this.vendorLineItems.getVendorLineItems(
          projectId, vendor.id, {},
        );
        for (const item of lineItems) {
          if (item.isService) continue;
          const ordered = item.orderedQty || 0;
          if (ordered <= 0) continue;
          const received = item.receivedQty || 0;
          totalOrdered += ordered;
          totalFulfilled += Math.min(received, ordered);
        }
      } catch (err) {
        this.logger.warn(`Failed to compute line items for vendor ${vendor.id}: ${err}`);
      }
    }

    return totalOrdered > 0 ? (totalFulfilled / totalOrdered) * 100 : 0;
  }

  async getProjectVendors(id: string, companyId?: string) {
    const project = await this.ensureExists(id, companyId);

    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: { projectId: id, isQuote: false },
      select: {
        id: true,
        supplierId: true,
        supplierName: true,
        supplier: { select: { id: true, name: true } },
      },
    });

    // Cache name→supplierId lookups so we don't query multiple times for the same name
    const nameToIdCache = new Map<string, string>();
    const resolveSupplierKey = async (
      supplierId: string | null,
      supplierName: string,
      supplier: { id: string; name: string } | null,
    ): Promise<{ key: string; name: string }> => {
      if (supplier) return { key: supplier.id, name: supplier.name };
      if (supplierId) return { key: supplierId, name: supplierName };
      // No supplierId — find or create a supplier record by name
      if (!nameToIdCache.has(supplierName)) {
        const resolved = await this.suppliersService.findOrCreate(supplierName, project.companyId);
        if (resolved) {
          nameToIdCache.set(supplierName, resolved.id);
        }
      }
      const resolvedId = nameToIdCache.get(supplierName);
      if (!resolvedId) {
        this.logger.warn(`Could not resolve supplier for name "${supplierName}"`);
        return { key: supplierName, name: supplierName };
      }
      return { key: resolvedId, name: supplierName };
    };

    const vendorMap = new Map<string, { id: string; name: string; poCount: number; poIds: string[] }>();
    for (const po of purchaseOrders) {
      const { key, name } = await resolveSupplierKey(po.supplierId, po.supplierName, po.supplier);
      // Link PO to the resolved supplier if it wasn't linked before
      if (!po.supplierId && key !== po.supplierName) {
        await this.prisma.purchaseOrder.update({
          where: { id: po.id },
          data: { supplierId: key },
        }).catch((err) => this.logger.warn(`Failed to link PO ${po.id} to supplier ${key}: ${err}`));
      }
      if (!vendorMap.has(key)) {
        vendorMap.set(key, { id: key, name, poCount: 0, poIds: [] });
      }
      const entry = vendorMap.get(key)!;
      entry.poCount++;
      entry.poIds.push(po.id);
    }

    // Also include vendors from invoices/DNs that don't have POs yet (bug fix: vendors with only invoices/DNs were invisible)
    const [invoicesInProject, dnsInProject] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { projectId: id },
        select: { id: true, supplierId: true, supplierName: true, supplier: { select: { id: true, name: true } } },
      }),
      this.prisma.deliveryNote.findMany({
        where: { projectId: id },
        select: { id: true, supplierId: true, supplierName: true, supplier: { select: { id: true, name: true } } },
      }),
    ]);

    // Filter out DNs/invoices already covered by a PO-backed match (sub-supplier case:
    // e.g. Nirlat DN shipped on behalf of Kaveret — shouldn't create a phantom "Nirlat" vendor)
    const matchesWithPO = await this.prisma.threeWayMatch.findMany({
      where: {
        companyId: project.companyId,
        purchaseOrderId: { not: null },
        OR: [
          { purchaseOrder: { projectId: id } },
          { deliveryNotes: { some: { projectId: id } } },
          { invoices: { some: { projectId: id } } },
        ],
      },
      select: {
        deliveryNotes: { select: { id: true } },
        invoices: { select: { id: true } },
      },
    });
    const coveredDnIds = new Set(matchesWithPO.flatMap((m) => m.deliveryNotes.map((dn) => dn.id)));
    const coveredInvIds = new Set(matchesWithPO.flatMap((m) => m.invoices.map((inv) => inv.id)));

    for (const doc of [...invoicesInProject, ...dnsInProject]) {
      // Skip documents already covered by a PO-backed match
      if (coveredDnIds.has(doc.id) || coveredInvIds.has(doc.id)) continue;
      const { key, name } = await resolveSupplierKey(doc.supplierId, doc.supplierName, doc.supplier);
      if (key && !vendorMap.has(key)) {
        vendorMap.set(key, { id: key, name: name || 'Unknown', poCount: 0, poIds: [] });
      }
    }

    const poIds = purchaseOrders.map((po) => po.id);
    const matches = poIds.length > 0
      ? await this.prisma.threeWayMatch.findMany({
          where: { purchaseOrderId: { in: poIds } },
          select: { purchaseOrderId: true, discrepancies: true },
        })
      : [];

    const result = Array.from(vendorMap.values()).map((vendor) => {
      const vendorMatches = matches.filter((m) => vendor.poIds.includes(m.purchaseOrderId!));
      // Count only real business problems — exclude noise from the line-item
      // fuzzy/orphan matcher ("not_found_in_po/dn/invoice"). Those fire even when
      // the documents are clearly linked at the doc level, because the matcher
      // can't bridge name variants (e.g. "0.55" vs "0.6") or 1-to-many row splits.
      const uniqueFields = new Set<string>();
      for (const m of vendorMatches) {
        const discs = Array.isArray(m.discrepancies) ? (m.discrepancies as any[]) : [];
        for (const d of discs) {
          if (!d?.field) continue;
          const desc: string = d.description || '';
          if (desc.includes('not_found_in_po') || desc.includes('not_found_in_dn') || desc.includes('not_found_in_invoice')) {
            continue;
          }
          uniqueFields.add(d.field);
        }
      }
      const discrepancyCount = uniqueFields.size;

      return {
        id: vendor.id,
        name: vendor.name,
        initials: vendor.name.substring(0, 2).toUpperCase(),
        purchaseOrderCount: vendor.poCount,
        discrepancyCount,
      };
    });

    return result.sort((a, b) => b.discrepancyCount - a.discrepancyCount);
  }

  async getVendorPurchaseOrders(projectId: string, vendorId: string, companyId?: string) {
    await this.ensureExists(projectId, companyId);
    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: {
        projectId,
        isQuote: false,
        OR: [{ supplierId: vendorId }, { supplierName: vendorId }],
      },
      select: { id: true, poNumber: true, totalAmount: true },
      orderBy: { poNumber: 'asc' },
    });

    return purchaseOrders.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      totalAmount: Number(po.totalAmount) || 0,
    }));
  }

  async checkNeedsReconciliation(projectId: string): Promise<boolean> {
    const [dn, po, inv] = await Promise.all([
      this.prisma.deliveryNote.count({ where: { projectId, needsReconciliation: true } }),
      this.prisma.purchaseOrder.count({ where: { projectId, needsReconciliation: true } }),
      this.prisma.invoice.count({ where: { projectId, needsReconciliation: true } }),
    ]);
    return (dn + po + inv) > 0;
  }
}
