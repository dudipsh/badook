import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { safeParseDate } from '../../utils/date.utils';
import { safeDecimal } from '../../utils/decimal.utils';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliers: SuppliersService,
    private readonly storage: StorageService,
  ) {}

  async findDuplicate(invoiceNumber: string, companyId: string) {
    return this.prisma.invoice.findFirst({
      where: { invoiceNumber, companyId },
      include: { lineItems: true },
    });
  }

  async findAll(companyId: string, query: QueryInvoicesDto) {
    const where = this.buildWhereClause(companyId, query);
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: { lineItems: true, supplier: true },
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
        skip: ((query.page || 1) - 1) * (query.limit || 20),
        take: query.limit || 20,
      }),
      this.prisma.invoice.count({ where }),
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
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        supplier: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (companyId && invoice.companyId !== companyId) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async create(data: {
    invoiceNumber: string;
    supplierName: string;
    companyId: string;
    createdById: string;
    invoiceDate?: string;
    dueDate?: string;
    totalAmount?: number;
    vatAmount?: number;
    currency?: string;
    notes?: string;
    lineItems?: Array<{
      description: string;
      catalogNumber?: string;
      quantity: number;
      unit?: string;
      unitPrice?: number;
      totalPrice?: number;
    }>;
  }) {
    return this.prisma.invoice.create({
      data: {
        invoiceNumber: data.invoiceNumber,
        supplierName: data.supplierName,
        companyId: data.companyId,
        createdById: data.createdById,
        invoiceDate: safeParseDate(data.invoiceDate),
        dueDate: safeParseDate(data.dueDate),
        totalAmount:
          data.totalAmount != null
            ? new Prisma.Decimal(data.totalAmount)
            : null,
        vatAmount:
          data.vatAmount != null ? new Prisma.Decimal(data.vatAmount) : null,
        currency: data.currency,
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
                  sortOrder: index,
                })),
            }
          : undefined,
      },
      include: { lineItems: true },
    });
  }

  async update(id: string, dto: UpdateInvoiceDto, companyId?: string) {
    await this.findOne(id, companyId);
    return this.prisma.invoice.update({
      where: { id },
      data: {
        invoiceNumber: dto.invoiceNumber,
        supplierName: dto.supplierName,
        supplierId: dto.supplierId,
        status: dto.status,
        currency: dto.currency,
        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        totalAmount:
          dto.totalAmount != null
            ? new Prisma.Decimal(dto.totalAmount)
            : undefined,
        vatAmount:
          dto.vatAmount != null
            ? new Prisma.Decimal(dto.vatAmount)
            : undefined,
      },
      include: { lineItems: true },
    });
  }

  async updateFileUrl(id: string, originalFileUrl: string) {
    return this.prisma.invoice.update({
      where: { id },
      data: { originalFileUrl },
    });
  }

  async updateFileUrls(id: string, compressedUrl: string, hqUrl: string) {
    return this.prisma.invoice.update({
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
    return this.prisma.invoice.delete({ where: { id } });
  }

  async createFromParsed(data: {
    supplierName: string;
    companyId: string;
    source: string;
    originalFileUrl: string;
    parsedData: any;
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate?: string;
    totalAmount?: number;
    vatAmount?: number;
    supplierDetails?: { phone?: string; email?: string; address?: string; businessId?: string };
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
    if (data.invoiceNumber && data.companyId) {
      const existing = await this.findDuplicate(data.invoiceNumber, data.companyId);
      if (existing) return existing;
    }

    // Auto-create supplier if not exists
    const supplier = await this.suppliers.findOrCreate(data.supplierName, data.companyId, data.supplierDetails);

    try {
    return await this.prisma.invoice.create({
      data: {
        supplierName: data.supplierName,
        supplierId: supplier?.id,
        companyId: data.companyId,
        source: data.source,
        originalFileUrl: data.originalFileUrl,
        parsedData: data.parsedData,
        invoiceNumber: data.invoiceNumber || 'UNKNOWN',
        invoiceDate: safeParseDate(data.invoiceDate),
        dueDate: safeParseDate(data.dueDate),
        totalAmount: safeDecimal(data.totalAmount),
        vatAmount: safeDecimal(data.vatAmount),
        needsReconciliation: true,
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
                  sortOrder: index,
                })),
            }
          : undefined,
      },
      include: { lineItems: true },
    });
    } catch (error) {
      this.logger.error(`invoice.create failed for ${data.invoiceNumber}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  private buildWhereClause(
    companyId: string,
    query: QueryInvoicesDto,
  ): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = { companyId };

    if (query.status) {
      where.status = { in: query.status.split(',') };
    }
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.search) {
      where.OR = [
        { supplierName: { contains: query.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
