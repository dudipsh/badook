import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { PriceFingerprintService } from '../matching/price-fingerprint.service';
import { buildLineItem, LineItemOverride } from './build-line-item';

@Injectable()
export class VendorLineItemsService {
  private readonly logger = new Logger(VendorLineItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingService: MatchingService,
    private readonly priceFingerprintService: PriceFingerprintService,
  ) { }

  private async ensureExists(id: string, companyId?: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (companyId && project.companyId !== companyId) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async getVendorLineItems(
    projectId: string,
    vendorId: string,
    filters: {
      poId?: string;
      status?: string;
      groupBy?: 'orders' | 'deliveryNotes' | 'invoices';
      dateFrom?: string;
      dateTo?: string;
    },
    companyId?: string,
  ) {
    if (companyId) {
      await this.ensureExists(projectId, companyId);
    }
    if (filters.groupBy === 'deliveryNotes') {
      return this.getVendorLineItemsByDN(projectId, vendorId, filters);
    }
    if (filters.groupBy === 'invoices') {
      return this.getVendorLineItemsByInvoice(projectId, vendorId, filters);
    }

    const poWhere: any = {
      projectId,
      isQuote: false,
      OR: [{ supplierId: vendorId }, { supplierName: vendorId }],
    };
    if (filters.poId) poWhere.id = filters.poId;

    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: poWhere,
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    const poIds = purchaseOrders.map((po) => po.id);
    const matches = poIds.length > 0
      ? await this.prisma.threeWayMatch.findMany({
        where: { purchaseOrderId: { in: poIds } },
        include: {
          deliveryNotes: {
            select: {
              id: true,
              noteNumber: true,
              deliveryDate: true,
              originalFileUrl: true,
              originalFileName: true,
              lineItems: true,
            },
          },
          invoices: {
            select: {
              id: true,
              invoiceNumber: true,
              originalFileUrl: true,
              lineItems: true,
            },
          },
        },
      })
      : [];

    const matchByPoId = new Map(matches.map((m) => [m.purchaseOrderId, m]));

    // Build cross-match DN & Invoice line exclusion sets:
    // When multiple POs share the same DNs/invoices, each PO should only count
    // lines explicitly paired to it, not lines paired to other POs.
    const dnLineClaimsByMatchId = new Map<string, Set<string>>();
    const invLineClaimsByMatchId = new Map<string, Set<string>>();
    for (const m of matches) {
      const dnClaimed = new Set<string>();
      const invClaimed = new Set<string>();
      for (const p of (m.lineItemPairings as any[]) || []) {
        if (p?.dn?.id) dnClaimed.add(p.dn.id);
        if (p?.inv?.id) invClaimed.add(p.inv.id);
      }
      dnLineClaimsByMatchId.set(m.id, dnClaimed);
      invLineClaimsByMatchId.set(m.id, invClaimed);
    }

    // Batch-fetch latest audit log overrides for all PO line items
    const allPoLineItemIds = purchaseOrders.flatMap((po) => po.lineItems.map((li: any) => li.id));
    const overridesMap = await this.getLatestOverrides(allPoLineItemIds);

    const poCompanyId = purchaseOrders[0]?.companyId;

    const items: any[] = [];

    for (const po of purchaseOrders) {
      const match = matchByPoId.get(po.id);
      const pairings = (match?.lineItemPairings as any[]) || [];

      // DN & Invoice line IDs claimed by OTHER matches (other POs sharing the same DNs/invoices)
      const crossExcludedDn = new Set<string>();
      const crossExcludedInv = new Set<string>();
      if (match) {
        for (const [matchId, dnClaimed] of dnLineClaimsByMatchId) {
          if (matchId !== match.id) {
            for (const id of dnClaimed) crossExcludedDn.add(id);
          }
        }
        for (const [matchId, invClaimed] of invLineClaimsByMatchId) {
          if (matchId !== match.id) {
            for (const id of invClaimed) crossExcludedInv.add(id);
          }
        }
      }

      for (const lineItem of po.lineItems) {
        const override = overridesMap.get(lineItem.id);
        const item = buildLineItem(po, lineItem, match, pairings, override, crossExcludedDn.size > 0 ? crossExcludedDn : undefined, crossExcludedInv.size > 0 ? crossExcludedInv : undefined);

        // Apply status filter
        if (filters.status && filters.status !== 'all') {
          if (filters.status === 'mismatches' && item.invoicedStatus !== 'mismatch') continue;
          if (filters.status === 'matched' && item.invoicedStatus !== 'matched') continue;
          if (filters.status === 'pending' && item.invoicedStatus !== 'pending') continue;
        }

        items.push(item);

        // Learn corrected prices into catalog (fire-and-forget)
        if (
          poCompanyId &&
          item.unitPrice > 0 &&
          (lineItem as any).catalogNumber &&
          item.invoicedStatus !== 'pending'
        ) {
          this.priceFingerprintService.learnFromInvoice(poCompanyId, {
            catalogNumber: (lineItem as any).catalogNumber,
            description: lineItem.description,
            unit: lineItem.unit,
            unitPrice: item.unitPrice,
          }).catch(() => {});
        }
      }
    }

    return items;
  }

  /** Batch-fetch the latest override values from audit logs for a set of PO line item IDs */
  async getLatestOverrides(poLineItemIds: string[]): Promise<Map<string, LineItemOverride>> {
    if (poLineItemIds.length === 0) return new Map();

    const logs = await this.prisma.lineItemAuditLog.findMany({
      where: { poLineItemId: { in: poLineItemIds } },
      orderBy: { createdAt: 'desc' },
    });

    const map = new Map<string, LineItemOverride>();
    for (const log of logs) {
      const key = log.poLineItemId!;
      if (!map.has(key)) {
        map.set(key, {});
      }
      const entry = map.get(key)!;
      // Only set if not already set (we ordered by desc, so first = latest)
      if (log.fieldName === 'invoicedQty' && entry.invoicedQty == null) {
        entry.invoicedQty = Number(log.newValue);
      } else if (log.fieldName === 'unitPrice' && entry.unitPrice == null) {
        entry.unitPrice = Number(log.newValue);
      } else if (log.fieldName === 'unit' && entry.unit == null) {
        entry.unit = log.newValue;
      }
    }

    return map;
  }

  /** Get line items grouped by delivery notes (DN-centric view) */
  private async getVendorLineItemsByDN(
    projectId: string,
    vendorId: string,
    filters: { status?: string; dateFrom?: string; dateTo?: string },
  ) {
    const dnWhere: any = {
      projectId,
      OR: [{ supplierId: vendorId }, { supplierName: vendorId }],
    };
    if (filters.dateFrom || filters.dateTo) {
      dnWhere.deliveryDate = {};
      if (filters.dateFrom) dnWhere.deliveryDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) dnWhere.deliveryDate.lte = new Date(filters.dateTo);
    }

    const deliveryNotes = await this.prisma.deliveryNote.findMany({
      where: dnWhere,
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { deliveryDate: 'desc' },
    });

    const dnIds = deliveryNotes.map((dn) => dn.id);
    const matches = dnIds.length > 0
      ? await this.prisma.threeWayMatch.findMany({
          where: { deliveryNotes: { some: { id: { in: dnIds } } } },
          include: {
            purchaseOrder: { include: { lineItems: true } },
            deliveryNotes: {
              select: {
                id: true,
                noteNumber: true,
                deliveryDate: true,
                originalFileUrl: true,
                originalFileName: true,
                lineItems: true,
              },
            },
            invoices: { select: { id: true, invoiceNumber: true, originalFileUrl: true, lineItems: true } },
          },
        })
      : [];

    // Build a map: dnId -> match (using already-included deliveryNotes)
    const matchByDnId = new Map<string, any>();
    for (const m of matches) {
      for (const dn of m.deliveryNotes) {
        if (dnIds.includes(dn.id)) matchByDnId.set(dn.id, m);
      }
    }

    const items: any[] = [];

    for (const dn of deliveryNotes) {
      const match = matchByDnId.get(dn.id);
      const pairings = (match?.lineItemPairings as any[]) || [];
      const po = match?.purchaseOrder;

      for (const lineItem of dn.lineItems) {
        // Find PO pairing for this DN line item
        const pairing = pairings.find((p: any) => p?.dn?.index === lineItem.sortOrder) ||
          pairings.find((p: any) => (p?.dn?.description?.trim() || '') === (lineItem.description?.trim() || ''));

        const poLineItem = pairing?.po && po
          ? po.lineItems.find((pli: any) => pli.sortOrder === pairing.po.index) ||
            po.lineItems.find((pli: any) => (pli.description?.trim() || '') === (pairing.po.description?.trim() || ''))
          : null;

        const unitPrice = lineItem.unitPrice != null ? Number(lineItem.unitPrice) : (poLineItem ? Number(poLineItem.unitPrice) || null : null);
        const priceSource = lineItem.priceSource || (lineItem.unitPrice != null ? 'document' : (poLineItem ? 'po_matched' : null));
        const quantity = Number(lineItem.quantity) || 0;
        const orderedQty = poLineItem ? Number(poLineItem.quantity) || 0 : null;

        // Calculate cumulative delivery tracking across all DNs in the match
        let totalReceivedForLine = 0;
        let shipmentCount = 0;
        if (pairing?.po && match?.deliveryNotes) {
          for (const matchDn of match.deliveryNotes) {
            const matchPairings = (match.lineItemPairings as any[]) || [];
            // Find a DN line item in this DN that pairs to the same PO line
            const matchDnLi = matchDn.lineItems.find((li: any) => {
              const dnPairing = matchPairings.find((p: any) => p?.dn?.index === li.sortOrder) ||
                matchPairings.find((p: any) => (p?.dn?.description?.trim() || '') === (li.description?.trim() || ''));
              return dnPairing?.po?.index === pairing.po.index;
            });
            if (matchDnLi) {
              totalReceivedForLine += Number(matchDnLi.quantity) || 0;
              shipmentCount++;
            }
          }
        }

        const remaining = orderedQty != null ? Math.round((orderedQty - totalReceivedForLine) * 100) / 100 : null;
        const deliveryStatus: 'full' | 'partial' | 'none' = orderedQty != null
          ? (orderedQty - totalReceivedForLine <= 0 ? 'full' : 'partial')
          : 'none';

        // Build related documents
        const relatedDocuments: any[] = [];
        if (dn.originalFileUrl) {
          relatedDocuments.push({ type: 'DC', name: dn.originalFileName || `DC-${dn.noteNumber || dn.id.substring(0, 6)}`, documentNumber: dn.noteNumber || null, fileUrl: dn.originalFileUrl });
        }
        if (po?.originalFileUrl) {
          relatedDocuments.push({ type: 'PO', name: `${po.poNumber}.pdf`, documentNumber: po.poNumber || null, fileUrl: po.originalFileUrl });
        }
        if (match?.invoices && pairing?.inv) {
          const targetInv = pairing.inv.invoiceIdx != null
            ? match.invoices[pairing.inv.invoiceIdx]
            : match.invoices.find((inv: any) =>
                inv.lineItems?.some((li: any) => li.sortOrder === pairing.inv!.index),
              );
          if (targetInv) {
            relatedDocuments.push({ type: 'INV', name: `Inv-${targetInv.invoiceNumber}`, documentNumber: targetInv.invoiceNumber || null, fileUrl: targetInv.originalFileUrl });
          }
        }

        const totalPrice = unitPrice != null ? quantity * unitPrice : null;
        const item = {
          id: lineItem.id,
          description: lineItem.description,
          quantity,
          unit: lineItem.unit ?? poLineItem?.unit ?? null,
          unitPrice,
          totalPrice,
          lineTotal: totalPrice ?? 0,
          priceSource,
          priceConfirmed: priceSource != null,
          // DN context
          dnId: dn.id,
          dnNoteNumber: dn.noteNumber,
          dnDeliveryDate: dn.deliveryDate?.toISOString() || null,
          // PO context (if matched)
          poId: po?.id || null,
          poNumber: po?.poNumber || match?.tempPoNumber || null,
          orderedQty,
          // Cross-reference fields
          receivedQty: quantity,
          totalReceivedForLine,
          remaining,
          deliveryStatus,
          shipmentCount,
          // Matching
          matchId: match?.id || null,
          catalogNumber: lineItem.catalogNumber,
          relatedDocuments,
          currency: 'ILS',
          groupBy: 'deliveryNotes' as const,
        };

        if (filters.status && filters.status !== 'all') {
          if (filters.status === 'pending' && item.priceConfirmed) continue;
          if (filters.status === 'matched' && !item.priceConfirmed) continue;
        }

        items.push(item);
      }
    }

    return items;
  }

  /** Get line items grouped by invoices (Invoice-centric view) */
  private async getVendorLineItemsByInvoice(
    projectId: string,
    vendorId: string,
    filters: { status?: string; dateFrom?: string; dateTo?: string },
  ) {
    const invWhere: any = {
      projectId,
      OR: [{ supplierId: vendorId }, { supplierName: vendorId }],
    };
    if (filters.dateFrom || filters.dateTo) {
      invWhere.invoiceDate = {};
      if (filters.dateFrom) invWhere.invoiceDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) invWhere.invoiceDate.lte = new Date(filters.dateTo);
    }

    const invoices = await this.prisma.invoice.findMany({
      where: invWhere,
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { invoiceDate: 'desc' },
    });

    const invIds = invoices.map((inv) => inv.id);
    const matches = invIds.length > 0
      ? await this.prisma.threeWayMatch.findMany({
          where: { invoices: { some: { id: { in: invIds } } } },
          include: {
            purchaseOrder: { include: { lineItems: true } },
            deliveryNotes: { select: { id: true, noteNumber: true, deliveryDate: true, originalFileUrl: true, originalFileName: true, lineItems: true } },
            invoices: { select: { id: true } },
          },
        })
      : [];

    // Build a map: invId -> match (using already-included invoices)
    const matchByInvId = new Map<string, any>();
    for (const m of matches) {
      for (const inv of m.invoices || []) {
        if (invIds.includes(inv.id)) matchByInvId.set(inv.id, m);
      }
    }

    const items: any[] = [];

    for (const inv of invoices) {
      const match = matchByInvId.get(inv.id);
      const pairings = (match?.lineItemPairings as any[]) || [];
      const po = match?.purchaseOrder;

      for (const lineItem of inv.lineItems) {
        const pairing = pairings.find((p: any) => p?.inv?.index === lineItem.sortOrder) ||
          pairings.find((p: any) => (p?.inv?.description?.trim() || '') === (lineItem.description?.trim() || ''));

        const poLineItem = pairing?.po && po
          ? po.lineItems.find((pli: any) => pli.sortOrder === pairing.po.index) ||
            po.lineItems.find((pli: any) => (pli.description?.trim() || '') === (pairing.po.description?.trim() || ''))
          : null;

        // Calculate DN cross-reference: total received and shipment count
        let totalReceivedQty = 0;
        let shipmentCount = 0;
        let receivedUnit: string | null = null;

        if (pairing?.dn && match?.deliveryNotes) {
          for (const dn of match.deliveryNotes) {
            const dnLi = dn.lineItems.find((li: any) => li.sortOrder === pairing.dn.index)
                      || dn.lineItems.find((li: any) => (li.description?.trim() || '') === (pairing.dn.description?.trim() || ''));
            if (dnLi) {
              totalReceivedQty += Number(dnLi.quantity) || 0;
              if (!receivedUnit) receivedUnit = dnLi.unit;
              shipmentCount++;
            }
          }
        }

        const relatedDocuments: any[] = [];
        if (inv.originalFileUrl) {
          relatedDocuments.push({ type: 'INV', name: `Inv-${inv.invoiceNumber}`, documentNumber: inv.invoiceNumber || null, fileUrl: inv.originalFileUrl });
        }
        if (po?.originalFileUrl) {
          relatedDocuments.push({ type: 'PO', name: `${po.poNumber}.pdf`, documentNumber: po.poNumber || null, fileUrl: po.originalFileUrl });
        }
        if (match?.deliveryNotes) {
          for (const dn of match.deliveryNotes) {
            relatedDocuments.push({ type: 'DC', name: dn.originalFileName || `DC-${dn.noteNumber || dn.id.substring(0, 6)}`, documentNumber: dn.noteNumber || null, fileUrl: dn.originalFileUrl });
          }
        }

        const invQty = Number(lineItem.quantity) || 0;
        const invUnitPrice = lineItem.unitPrice != null ? Number(lineItem.unitPrice) : null;
        const invTotalPrice = lineItem.totalPrice != null ? Number(lineItem.totalPrice) : null;
        const lineTotal = invTotalPrice ?? (invQty * (invUnitPrice ?? 0));

        items.push({
          id: lineItem.id,
          description: lineItem.description,
          quantity: invQty,
          unit: lineItem.unit,
          unitPrice: invUnitPrice,
          totalPrice: invTotalPrice,
          lineTotal,
          // Invoice context
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate?.toISOString() || null,
          // PO context
          poId: po?.id || null,
          poNumber: po?.poNumber || match?.tempPoNumber || null,
          orderedQty: poLineItem ? Number(poLineItem.quantity) || 0 : null,
          // DN cross-reference
          receivedQty: totalReceivedQty,
          shipmentCount,
          receivedUnit,
          // Matching
          matchId: match?.id || null,
          catalogNumber: lineItem.catalogNumber,
          relatedDocuments,
          currency: inv.currency || 'ILS',
          groupBy: 'invoices' as const,
        });
      }
    }

    return items;
  }

  /** Find the InvoiceLineItem corresponding to a POLineItem via ThreeWayMatch pairings */
  findInvoiceLineItem(
    poLineItem: any,
    match: any,
  ): { invoiceLineItem: any; invoiceId: string } | null {
    if (!match) return null;
    const pairings = (match.lineItemPairings as any[]) || [];
    const poDesc = poLineItem.description?.trim() || '';
    const pairing =
      pairings.find((p: any) => p?.po?.index === poLineItem.sortOrder) ||
      pairings.find((p: any) => (p?.po?.description?.trim() || '') === poDesc);
    if (!pairing?.inv) return null;

    const invDesc = pairing.inv.description?.trim() || '';
    for (const inv of match.invoices || []) {
      const invLine = inv.lineItems?.find(
        (li: any) => (li.description?.trim() || '') === invDesc,
      );
      if (invLine) {
        return { invoiceLineItem: invLine, invoiceId: inv.id };
      }
    }
    return null;
  }
}
