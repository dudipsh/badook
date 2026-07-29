import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { safeParseDate } from '../../utils/date.utils';
import { safeDecimal } from '../../utils/decimal.utils';
import { QueryPODto } from './dto/query-po.dto';
import { UpdatePODto } from './dto/update-po.dto';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliers: SuppliersService,
    private readonly storage: StorageService,
  ) {}

  async findDuplicate(poNumber: string, companyId: string) {
    return this.prisma.purchaseOrder.findFirst({
      where: { poNumber, companyId },
      include: { lineItems: true },
    });
  }

  /** Find a PO by reference number (digits-only fuzzy match), including line items. */
  async findByReference(refDigits: string, companyId: string) {
    return this.prisma.purchaseOrder.findFirst({
      where: {
        companyId,
        poNumber: { contains: refDigits, mode: 'insensitive' },
      },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(companyId: string, query: QueryPODto) {
    const where = this.buildWhereClause(companyId, query);
    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { lineItems: true, supplier: true },
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
        skip: ((query.page || 1) - 1) * (query.limit || 20),
        take: query.limit || 20,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data,
      total,
      page: query.page || 1,
      limit: query.limit || 20,
      totalPages: Math.ceil(total / (query.limit || 20)),
    };
  }

  async findOne(id: string, companyId?: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        supplier: true,
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (companyId && po.companyId !== companyId) {
      throw new NotFoundException('Purchase order not found');
    }
    return po;
  }

  async create(data: {
    poNumber: string;
    supplierName: string;
    companyId: string;
    createdById: string;
    projectId?: string;
    orderDate?: string;
    expectedDelivery?: string;
    totalAmount?: number;
    currency?: string;
    notes?: string;
    paymentTerms?: string;
    vendorAddress?: string;
    vatNumber?: string;
    withholdingTax?: string;
    siteContact?: string;
    sitePhone?: string;
    deliveryNotes?: string;
    originalFileUrl?: string;
    lineItems?: Array<{
      description: string;
      catalogNumber?: string;
      quantity: number;
      unit?: string;
      unitPrice?: number;
      totalPrice?: number;
      discountPercent?: number;
    }>;
  }) {
    // Prevent duplicate PO numbers within same company
    const existing = await this.findDuplicate(data.poNumber, data.companyId);
    if (existing) {
      throw new ConflictException(`הזמנת רכש מספר ${data.poNumber} כבר קיימת במערכת`);
    }

    // Auto-create supplier if not exists
    const supplier = await this.suppliers.findOrCreate(data.supplierName, data.companyId, {
      address: data.vendorAddress,
      businessId: data.vatNumber,
    });

    return this.prisma.purchaseOrder.create({
      data: {
        poNumber: data.poNumber,
        supplierName: data.supplierName,
        supplierId: supplier?.id,
        companyId: data.companyId,
        createdById: data.createdById,
        projectId: data.projectId ?? null,
        source: 'MANUAL',
        needsReconciliation: true,
        orderDate: safeParseDate(data.orderDate),
        expectedDelivery: safeParseDate(data.expectedDelivery),
        totalAmount:
          data.totalAmount != null
            ? new Prisma.Decimal(data.totalAmount)
            : null,
        currency: data.currency,
        notes: data.notes,
        originalFileUrl: data.originalFileUrl ?? null,
        parsedData: {
          paymentTerms: data.paymentTerms,
          vendorAddress: data.vendorAddress,
          vatNumber: data.vatNumber,
          withholdingTax: data.withholdingTax,
          siteContact: data.siteContact,
          sitePhone: data.sitePhone,
          deliveryNotes: data.deliveryNotes,
        },
        lineItems: data.lineItems
          ? {
              create: data.lineItems
                .filter((item) => item.description)
                .map((item, index) => ({
                  description: item.description,
                  catalogNumber: item.catalogNumber != null ? String(item.catalogNumber) : null,
                  quantity: new Prisma.Decimal(Number(item.quantity) || 0),
                  unit: item.unit ?? null,
                  unitPrice:
                    item.unitPrice != null && !isNaN(Number(item.unitPrice))
                      ? new Prisma.Decimal(item.unitPrice)
                      : null,
                  totalPrice:
                    item.totalPrice != null && !isNaN(Number(item.totalPrice))
                      ? new Prisma.Decimal(item.totalPrice)
                      : null,
                  discountPercent:
                    item.discountPercent != null && !isNaN(Number(item.discountPercent))
                      ? new Prisma.Decimal(item.discountPercent)
                      : null,
                  sortOrder: index,
                })),
            }
          : undefined,
      },
      include: { lineItems: true },
    });
  }

  async update(id: string, dto: UpdatePODto, companyId?: string) {
    await this.findOne(id, companyId);
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        poNumber: dto.poNumber,
        supplierName: dto.supplierName,
        status: dto.status,
        notes: dto.notes,
        currency: dto.currency,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
        expectedDelivery: dto.expectedDelivery
          ? new Date(dto.expectedDelivery)
          : undefined,
        totalAmount:
          dto.totalAmount != null
            ? new Prisma.Decimal(dto.totalAmount)
            : undefined,
      },
      include: { lineItems: true },
    });
  }

  async updateFileUrl(id: string, originalFileUrl: string) {
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { originalFileUrl },
    });
  }

  async updateFileUrls(id: string, compressedUrl: string, hqUrl: string) {
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { originalFileUrl: compressedUrl, originalFileUrlHq: hqUrl },
    });
  }

  async delete(id: string, companyId?: string) {
    const doc = await this.findOne(id, companyId);
    // Delete S3 files before removing DB record
    for (const key of [doc.originalFileUrl, (doc as any).originalFileUrlHq]) {
      if (key) { try { await this.storage.delete(key); } catch { /* best-effort */ } }
    }
    return this.prisma.purchaseOrder.delete({ where: { id } });
  }

  async createFromParsed(data: {
    supplierName: string;
    companyId: string;
    source: string;
    originalFileUrl: string;
    parsedData: any;
    poNumber?: string;
    orderDate?: string;
    totalAmount?: number;
    supplierDetails?: { phone?: string; email?: string; address?: string; businessId?: string };
    quoteReference?: string;
    isQuote?: boolean;
    lineItems?: Array<{
      description: string;
      catalogNumber?: string;
      quantity: number;
      unit?: string;
      unitPrice?: number;
      totalPrice?: number;
      discountPercent?: number;
      discountAmount?: number;
      priceBeforeDiscount?: number;
    }>;
    createdById?: string;
    projectId?: string;
  }) {
    // Reject POs where the AI hallucinated an UNKNOWN/empty PO number.
    // These are typically created when the AI reads a project reference embedded
    // inside a line item description and mistakenly treats it as a standalone PO.
    const normalizedPoNumber = (data.poNumber || '').trim().toUpperCase();
    if (!normalizedPoNumber || normalizedPoNumber === 'UNKNOWN') {
      console.warn(`[PurchaseOrdersService] Skipping PO with invalid poNumber: "${data.poNumber}" for supplier "${data.supplierName}"`);
      return null;
    }
    // PQ-prefixed numbers are valid for price quotes — auto-mark as quote if not already
    if (/^PQ/i.test(normalizedPoNumber) && !data.isQuote) {
      console.warn(`[PurchaseOrdersService] PQ number "${data.poNumber}" without isQuote flag — auto-marking as quote`);
      data.isQuote = true;
    }

    if (data.poNumber && data.companyId) {
      const existing = await this.findDuplicate(data.poNumber, data.companyId);
      if (existing) return existing;
    }

    // Auto-create supplier if not exists
    const supplier = await this.suppliers.findOrCreate(data.supplierName, data.companyId, data.supplierDetails);

    return this.prisma.purchaseOrder.create({
      data: {
        supplierName: data.supplierName,
        supplierId: supplier?.id,
        companyId: data.companyId,
        source: data.source,
        originalFileUrl: data.originalFileUrl,
        parsedData: data.parsedData,
        poNumber: data.poNumber || 'UNKNOWN',
        orderDate: safeParseDate(data.orderDate),
        totalAmount: safeDecimal(data.totalAmount),
        needsReconciliation: true,
        quoteReference: data.quoteReference ?? null,
        isQuote: data.isQuote ?? false,
        projectId: data.projectId ?? null,
        createdById: data.createdById,
        lineItems: data.lineItems
          ? {
              create: data.lineItems
                .filter((item) => item.description)
                .map((item, index) => ({
                  description: item.description,
                  catalogNumber: item.catalogNumber != null ? String(item.catalogNumber) : null,
                  quantity: safeDecimal(item.quantity) ?? new Prisma.Decimal(0),
                  unit: item.unit ?? null,
                  unitPrice: safeDecimal(item.unitPrice),
                  totalPrice: safeDecimal(item.totalPrice),
                  discountPercent: safeDecimal(item.discountPercent),
                  discountAmount: safeDecimal(item.discountAmount),
                  priceBeforeDiscount: safeDecimal(item.priceBeforeDiscount),
                  remarks: (item as any).remarks ?? null,
                  expectedDeliveryDate: safeParseDate((item as any).expectedDeliveryDate),
                  sortOrder: index,
                })),
            }
          : undefined,
      },
      include: { lineItems: true },
    });
  }

  async getCompanyName(companyId: string): Promise<string | undefined> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    return company?.name;
  }

  private buildWhereClause(
    companyId: string,
    query: QueryPODto,
  ): Prisma.PurchaseOrderWhereInput {
    const where: Prisma.PurchaseOrderWhereInput = { companyId };

    if (query.status) {
      where.status = { in: query.status.split(',') };
    }
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.search) {
      where.OR = [
        { supplierName: { contains: query.search, mode: 'insensitive' } },
        { poNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
