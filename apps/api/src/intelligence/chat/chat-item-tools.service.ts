import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  ItemGroupBy,
  ItemLine,
  aggregateItemLines,
  buildDescriptionWhere,
  buildRelaxedDescriptionWheres,
} from './item-aggregation.helper';

type LineWhere = ReturnType<typeof buildDescriptionWhere>;

const MAX_LINES = 2000;
const MAX_DISTINCT_ITEMS = 20;
const MAX_DOCS = 50;

export type ItemDocType = 'delivery_note' | 'invoice' | 'purchase_order';

export interface AggregateItemArgs {
  itemQuery: string;
  docType?: string;
  groupBy?: string;
  projectId?: string;
  projectName?: string;
  supplierId?: string;
  supplierName?: string;
  dateFrom?: string;
  dateTo?: string;
}

const normalizeDocType = (v?: string): ItemDocType =>
  v === 'invoice' || v === 'purchase_order' ? v : 'delivery_note';

const normalizeGroupBy = (v?: string): ItemGroupBy =>
  v === 'project' || v === 'supplier' || v === 'month' ? v : 'none';

const toDateRange = (from?: string, to?: string) => {
  if (!from && !to) return null;
  return {
    ...(from ? { gte: new Date(`${from.slice(0, 10)}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to.slice(0, 10)}T23:59:59.999Z`) } : {}),
  };
};

@Injectable()
export class ChatItemToolsService {
  private readonly logger = new Logger(ChatItemToolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Distinct products matching a free-text query (disambiguation). Lines are
   * unified by catalog number so the SAME product printed under different
   * supplier descriptions (aliases) collapses into one item; the trimmed
   * description is used as the key only when no catalog number is present.
   */
  async findSuppliedItems(args: AggregateItemArgs, companyId: string) {
    const docType = normalizeDocType(args.docType);
    const { lines } = await this.fetchLines(docType, args, companyId, 1000);
    const byProduct = new Map<
      string,
      {
        description: string;
        catalogNumber: string | null;
        unit: string | null;
        lineCount: number;
        aliases: Set<string>;
      }
    >();
    for (const l of lines) {
      const desc = l.description.trim();
      const catalog = l.catalogNumber?.trim() || null;
      const key = catalog ?? desc.toLowerCase();
      const entry = byProduct.get(key) ?? {
        description: desc,
        catalogNumber: catalog,
        unit: l.unit,
        lineCount: 0,
        aliases: new Set<string>(),
      };
      entry.lineCount += 1;
      if (desc) entry.aliases.add(desc);
      byProduct.set(key, entry);
    }
    const items = [...byProduct.values()]
      .sort((a, b) => b.lineCount - a.lineCount)
      .slice(0, MAX_DISTINCT_ITEMS)
      .map(({ aliases, ...rest }) => ({ ...rest, aliases: [...aliases] }));
    return { itemQuery: args.itemQuery, docType, count: items.length, items };
  }

  /** Sums quantities + price stats for an item, with optional grouping. */
  async aggregateItemSupply(args: AggregateItemArgs, companyId: string) {
    const docType = normalizeDocType(args.docType);
    const groupBy = normalizeGroupBy(args.groupBy);
    const { lines, truncated } = await this.fetchLines(docType, args, companyId, MAX_LINES);
    const aggregation = aggregateItemLines(lines, groupBy, docType);
    const [filters, sourceDocCounts] = await Promise.all([
      this.resolveFilterLabels(args, companyId),
      this.countSourceDocs(args, companyId),
    ]);
    const sampleDescriptions = [...new Set(lines.map((l) => l.description.trim()))].slice(0, 5);
    return {
      itemQuery: args.itemQuery,
      docType,
      groupBy,
      filters,
      sourceDocCounts,
      ...aggregation,
      sampleDescriptions,
      truncated,
    };
  }

  /**
   * Lists the actual documents (deduped by docId) that carry the item — answers
   * "באיזה הזמנה/חשבונית יש לי X?". Each row is one document with the matched
   * quantity, price and total for that item, sorted most-recent first.
   */
  async listItemDocuments(args: AggregateItemArgs, companyId: string) {
    const docType = normalizeDocType(args.docType);
    const { lines, truncated } = await this.fetchLines(docType, args, companyId, MAX_LINES);
    const filters = await this.resolveFilterLabels(args, companyId);

    const map = new Map<
      string,
      {
        docNumber: string | null;
        docDate: string | null;
        projectId: string | null;
        projectName: string | null;
        supplierId: string | null;
        supplierName: string | null;
        qty: number;
        spend: number;
        pricedQty: number;
        weighted: number;
        lineCount: number;
        units: Map<string, number>;
      }
    >();
    for (const l of lines) {
      const g =
        map.get(l.docId) ??
        {
          docNumber: l.docNumber,
          docDate: l.docDate,
          projectId: l.projectId,
          projectName: l.projectName,
          supplierId: l.supplierId,
          supplierName: l.supplierName,
          qty: 0,
          spend: 0,
          pricedQty: 0,
          weighted: 0,
          lineCount: 0,
          units: new Map<string, number>(),
        };
      g.qty += l.quantity;
      g.spend += l.totalPrice ?? l.quantity * (l.unitPrice ?? 0);
      if (l.unitPrice != null && l.unitPrice > 0) {
        g.pricedQty += l.quantity;
        g.weighted += l.quantity * l.unitPrice;
      }
      g.lineCount += 1;
      const unit = (l.unit ?? '').trim();
      if (unit) g.units.set(unit, (g.units.get(unit) ?? 0) + l.quantity);
      map.set(l.docId, g);
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const round3 = (n: number) => Math.round(n * 1000) / 1000;
    const all = [...map.entries()].map(([docId, g]) => ({
      type: docType,
      docId,
      docNumber: g.docNumber,
      docDate: g.docDate,
      projectId: g.projectId,
      projectName: g.projectName,
      supplierId: g.supplierId,
      supplierName: g.supplierName,
      totalQuantity: round3(g.qty),
      unit: [...g.units.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      avgUnitPrice: g.pricedQty > 0 ? round2(g.weighted / g.pricedQty) : null,
      lineTotal: round2(g.spend),
      lineCount: g.lineCount,
    }));
    // Most recent first; undated documents sink to the bottom.
    all.sort((a, b) => (b.docDate ?? '').localeCompare(a.docDate ?? ''));
    const documents = all.slice(0, MAX_DOCS);

    return {
      itemQuery: args.itemQuery,
      docType,
      filters,
      count: documents.length,
      totalDocuments: all.length,
      documents,
      truncated: truncated || all.length > MAX_DOCS,
    };
  }

  /** Counts distinct invoices + delivery notes that carry the item (for the card footer). */
  private async countSourceDocs(args: AggregateItemArgs, companyId: string) {
    const lineWhere = { lineItems: { some: buildDescriptionWhere(args.itemQuery) } };
    const [invoices, deliveryNotes] = await Promise.all([
      this.prisma.invoice.count({
        where: { ...this.docWhere(companyId, args, 'invoiceDate'), ...lineWhere },
      }),
      this.prisma.deliveryNote.count({
        where: { ...this.docWhere(companyId, args, 'deliveryDate'), ...lineWhere },
      }),
    ]);
    return { invoices, deliveryNotes };
  }

  private async fetchLines(
    docType: ItemDocType,
    args: AggregateItemArgs,
    companyId: string,
    limit: number,
  ): Promise<{ lines: ItemLine[]; truncated: boolean }> {
    const fetchWith = (lineWhere: LineWhere) =>
      docType === 'invoice'
        ? this.fetchInvoiceLines(lineWhere, args, companyId, limit)
        : docType === 'purchase_order'
          ? this.fetchPoLines(lineWhere, args, companyId, limit)
          : this.fetchDeliveryLines(lineWhere, args, companyId, limit);

    let rows = await fetchWith(buildDescriptionWhere(args.itemQuery));
    // Relaxed fallback: a query may use a canonical word the documents never
    // print (suppliers print their own aliases). Drop one token at a time until
    // something matches — this recovers all aliases of the same product.
    if (rows.length === 0) {
      for (const relaxed of buildRelaxedDescriptionWheres(args.itemQuery)) {
        rows = await fetchWith(relaxed);
        if (rows.length > 0) break;
      }
    }
    return { lines: rows.slice(0, limit), truncated: rows.length > limit };
  }

  private docWhere(
    companyId: string,
    args: AggregateItemArgs,
    dateField: 'deliveryDate' | 'invoiceDate' | 'orderDate',
  ) {
    const dateRange = toDateRange(args.dateFrom, args.dateTo);
    return {
      companyId,
      ...(args.projectId ? { projectId: args.projectId } : {}),
      ...(args.projectName
        ? {
            project: {
              is: { name: { contains: args.projectName, mode: 'insensitive' as const } },
            },
          }
        : {}),
      ...(args.supplierId ? { supplierId: args.supplierId } : {}),
      ...(args.supplierName
        ? {
            OR: [
              { supplierName: { contains: args.supplierName, mode: 'insensitive' as const } },
              {
                supplier: {
                  is: { name: { contains: args.supplierName, mode: 'insensitive' as const } },
                },
              },
            ],
          }
        : {}),
      ...(dateRange ? { [dateField]: dateRange } : {}),
    };
  }

  private async fetchDeliveryLines(
    lineWhere: LineWhere,
    args: AggregateItemArgs,
    companyId: string,
    limit: number,
  ): Promise<ItemLine[]> {
    const rows = await this.prisma.lineItem.findMany({
      where: {
        ...lineWhere,
        deliveryNote: this.docWhere(companyId, args, 'deliveryDate'),
      },
      select: {
        description: true,
        quantity: true,
        receivedQuantity: true,
        unit: true,
        unitPrice: true,
        totalPrice: true,
        catalogNumber: true,
        deliveryNote: {
          select: {
            id: true,
            noteNumber: true,
            deliveryDate: true,
            supplierName: true,
            supplier: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
      take: limit + 1,
    });
    return rows.map((r) => ({
      description: r.description,
      // Handwritten corrections (received qty) win over the printed qty.
      quantity: Number(r.receivedQuantity ?? r.quantity),
      unit: r.unit,
      unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
      totalPrice: r.totalPrice != null ? Number(r.totalPrice) : null,
      catalogNumber: r.catalogNumber,
      docId: r.deliveryNote.id,
      docNumber: r.deliveryNote.noteNumber,
      docDate: r.deliveryNote.deliveryDate?.toISOString().slice(0, 10) ?? null,
      projectId: r.deliveryNote.project?.id ?? null,
      projectName: r.deliveryNote.project?.name ?? null,
      supplierId: r.deliveryNote.supplier?.id ?? null,
      supplierName: r.deliveryNote.supplier?.name ?? r.deliveryNote.supplierName,
    }));
  }

  private async fetchInvoiceLines(
    lineWhere: LineWhere,
    args: AggregateItemArgs,
    companyId: string,
    limit: number,
  ): Promise<ItemLine[]> {
    const rows = await this.prisma.invoiceLineItem.findMany({
      where: {
        ...lineWhere,
        invoice: this.docWhere(companyId, args, 'invoiceDate'),
      },
      select: {
        description: true,
        quantity: true,
        unit: true,
        unitPrice: true,
        totalPrice: true,
        catalogNumber: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            supplierName: true,
            supplier: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
      take: limit + 1,
    });
    return rows.map((r) => ({
      description: r.description,
      quantity: Number(r.quantity),
      unit: r.unit,
      unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
      totalPrice: r.totalPrice != null ? Number(r.totalPrice) : null,
      catalogNumber: r.catalogNumber,
      docId: r.invoice.id,
      docNumber: r.invoice.invoiceNumber,
      docDate: r.invoice.invoiceDate?.toISOString().slice(0, 10) ?? null,
      projectId: r.invoice.project?.id ?? null,
      projectName: r.invoice.project?.name ?? null,
      supplierId: r.invoice.supplier?.id ?? null,
      supplierName: r.invoice.supplier?.name ?? r.invoice.supplierName,
    }));
  }

  private async fetchPoLines(
    lineWhere: LineWhere,
    args: AggregateItemArgs,
    companyId: string,
    limit: number,
  ): Promise<ItemLine[]> {
    const rows = await this.prisma.pOLineItem.findMany({
      where: {
        ...lineWhere,
        purchaseOrder: this.docWhere(companyId, args, 'orderDate'),
      },
      select: {
        description: true,
        quantity: true,
        unit: true,
        unitPrice: true,
        totalPrice: true,
        catalogNumber: true,
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            orderDate: true,
            supplierName: true,
            supplier: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
      take: limit + 1,
    });
    return rows.map((r) => ({
      description: r.description,
      quantity: Number(r.quantity),
      unit: r.unit,
      unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
      totalPrice: r.totalPrice != null ? Number(r.totalPrice) : null,
      catalogNumber: r.catalogNumber,
      docId: r.purchaseOrder.id,
      docNumber: r.purchaseOrder.poNumber,
      docDate: r.purchaseOrder.orderDate?.toISOString().slice(0, 10) ?? null,
      projectId: r.purchaseOrder.project?.id ?? null,
      projectName: r.purchaseOrder.project?.name ?? null,
      supplierId: r.purchaseOrder.supplier?.id ?? null,
      supplierName: r.purchaseOrder.supplier?.name ?? r.purchaseOrder.supplierName,
    }));
  }

  private async resolveFilterLabels(args: AggregateItemArgs, companyId: string) {
    const [project, supplier] = await Promise.all([
      args.projectId
        ? this.prisma.project.findFirst({
            where: { id: args.projectId, companyId },
            select: { name: true },
          })
        : Promise.resolve(null),
      args.supplierId
        ? this.prisma.supplier.findFirst({
            where: { id: args.supplierId, companyId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);
    return {
      projectName: project?.name ?? args.projectName ?? null,
      supplierName: supplier?.name ?? args.supplierName ?? null,
      dateFrom: args.dateFrom ?? null,
      dateTo: args.dateTo ?? null,
    };
  }
}
