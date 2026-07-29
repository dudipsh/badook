import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, DeliveryNoteStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { safeParseDate } from '../../utils/date.utils';
import { safeDecimal } from '../../utils/decimal.utils';
import { ProjectsService } from '../projects/projects.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { QueryNotesDto } from './dto/query-notes.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class DeliveryNotesService {
  private readonly logger = new Logger(DeliveryNotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliers: SuppliersService,
    private readonly projects: ProjectsService,
    private readonly storage: StorageService,
  ) {}

  async findDuplicate(noteNumber: string, companyId: string) {
    return this.prisma.deliveryNote.findFirst({
      where: { noteNumber, companyId },
      include: { lineItems: true },
    });
  }

  async findAll(companyId: string, query: QueryNotesDto) {
    const where = this.buildWhereClause(companyId, query);
    const [data, total] = await Promise.all([
      this.prisma.deliveryNote.findMany({
        where,
        include: { lineItems: true, supplier: true, project: true },
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
        skip: ((query.page || 1) - 1) * (query.limit || 20),
        take: query.limit || 20,
      }),
      this.prisma.deliveryNote.count({ where }),
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
    const note = await this.prisma.deliveryNote.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        supplier: true,
        project: true,
      },
    });
    if (!note) throw new NotFoundException('Delivery note not found');
    if (companyId && note.companyId !== companyId) {
      throw new NotFoundException('Delivery note not found');
    }
    return note;
  }

  async update(id: string, dto: UpdateNoteDto, companyId?: string) {
    await this.findOne(id, companyId);
    return this.prisma.deliveryNote.update({
      where: { id },
      data: {
        ...dto,
        deliveryDate: dto.deliveryDate
          ? new Date(dto.deliveryDate)
          : undefined,
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

  async approve(id: string, userId: string, notes?: string, companyId?: string) {
    await this.findOne(id, companyId);
    return this.prisma.deliveryNote.update({
      where: { id },
      data: {
        status: DeliveryNoteStatus.APPROVED,
        approvedById: userId,
        approvedAt: new Date(),
        notes,
      },
    });
  }

  async reject(id: string, notes: string, companyId?: string) {
    await this.findOne(id, companyId);
    return this.prisma.deliveryNote.update({
      where: { id },
      data: { status: DeliveryNoteStatus.REJECTED, notes },
    });
  }

  async createFromParsed(data: {
    supplierName: string;
    companyId: string;
    source: 'EMAIL' | 'MOBILE' | 'MANUAL';
    originalFileUrl: string;
    originalFileName?: string;
    parsedData: any;
    parsingConfidence: number;
    noteNumber?: string;
    deliveryDate?: string;
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
      delivered?: boolean;
      receivedQuantity?: number;
      handwrittenNotes?: string;
      quantityBreakdown?: Array<{ label: string; value: number; unit: string }>;
    }>;
    emailScanLogId?: string;
    createdById?: string;
    projectName?: string;
    projectId?: string;
  }) {
    const status =
      data.parsingConfidence >= 0.5
        ? DeliveryNoteStatus.PARSED
        : DeliveryNoteStatus.PARSE_FAILED;

    // Prevent duplicates: if noteNumber exists for this company, return existing
    if (data.noteNumber && data.companyId) {
      const existing = await this.findDuplicate(data.noteNumber, data.companyId);
      if (existing) return existing;
    }

    // Auto-create supplier if not exists
    const supplier = await this.suppliers.findOrCreate(data.supplierName, data.companyId, data.supplierDetails);

    // Find existing project (DNs never create projects — only POs do)
    const project = data.projectName
      ? await this.projects.findExisting(data.projectName, data.companyId)
      : null;

    return this.prisma.deliveryNote.create({
      data: {
        supplierName: data.supplierName,
        supplierId: supplier?.id,
        projectId: data.projectId ?? project?.id ?? null,
        companyId: data.companyId,
        source: data.source,
        status,
        originalFileUrl: data.originalFileUrl,
        originalFileName: data.originalFileName,
        parsedData: data.parsedData,
        parsingConfidence: data.parsingConfidence,
        noteNumber: data.noteNumber,
        deliveryDate: safeParseDate(data.deliveryDate),
        totalAmount: safeDecimal(data.totalAmount),
        vatAmount: safeDecimal(data.vatAmount),
        needsReconciliation: true,
        emailScanLogId: data.emailScanLogId,
        createdById: data.createdById,
        lineItems: data.lineItems
          ? {
              create: data.lineItems
                .filter((item) => item.description && !item.description.trim().startsWith('--'))
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
                  delivered: item.delivered ?? true,
                  receivedQuantity: safeDecimal(item.receivedQuantity),
                  handwrittenNotes: item.handwrittenNotes ?? null,
                  quantityBreakdown: item.quantityBreakdown ?? undefined,
                  sortOrder: index,
                })),
            }
          : undefined,
      },
      include: { lineItems: true },
    });
  }

  async updateFileUrl(id: string, originalFileUrl: string) {
    return this.prisma.deliveryNote.update({
      where: { id },
      data: { originalFileUrl },
    });
  }

  async updateFileUrls(id: string, compressedUrl: string, hqUrl: string) {
    return this.prisma.deliveryNote.update({
      where: { id },
      data: { originalFileUrl: compressedUrl, originalFileUrlHq: hqUrl },
    });
  }

  async delete(id: string, companyId?: string) {
    const doc = await this.findOne(id, companyId);
    // Delete S3 files before removing DB record
    await this.deleteStorageFiles(doc.originalFileUrl, (doc as any).originalFileUrlHq);
    return this.prisma.deliveryNote.delete({ where: { id } });
  }

  private async deleteStorageFiles(...keys: (string | null | undefined)[]) {
    for (const key of keys) {
      if (key) {
        try { await this.storage.delete(key); } catch { /* best-effort */ }
      }
    }
  }

  async resetAll(companyId: string, deleteFeedback = false) {
    // 0. Delete files from S3/storage first (before DB records are gone)
    try {
      const deletedFiles = await this.storage.deleteCompanyFiles(companyId);
      this.logger.log(`Deleted ${deletedFiles} files from storage for company ${companyId}`);
    } catch (e) {
      this.logger.error(`Failed to delete storage files: ${(e as Error).message}`);
    }

    // Delete DB records in order respecting foreign keys
    // 1. Handle feedback records (FK to ThreeWayMatch)
    if (deleteFeedback) {
      await this.prisma.itemMatchFeedback.deleteMany({ where: { companyId } });
    } else {
      await this.prisma.itemMatchFeedback.updateMany({
        where: { companyId, threeWayMatchId: { not: null } },
        data: { threeWayMatchId: null },
      });
    }
    // 2. Three-way matches (references PO, DN, Invoice)
    await this.prisma.threeWayMatch.deleteMany({ where: { companyId } });
    // 3. Line items for delivery notes
    await this.prisma.lineItem.deleteMany({
      where: { deliveryNote: { companyId } },
    });
    // 4. Delivery notes
    await this.prisma.deliveryNote.deleteMany({ where: { companyId } });
    // 5. Purchase orders (cascade deletes POLineItems)
    await this.prisma.purchaseOrder.deleteMany({ where: { companyId } });
    // 6. Invoices (cascade deletes InvoiceLineItems)
    await this.prisma.invoice.deleteMany({ where: { companyId } });
    // 7. Email scan attachments + logs
    await this.prisma.emailScanAttachment.deleteMany({
      where: { emailScanLog: { companyId } },
    });
    await this.prisma.emailScanLog.deleteMany({ where: { companyId } });
    // 8. Suppliers
    await this.prisma.supplier.deleteMany({ where: { companyId } });
    // 9. Projects
    await this.prisma.project.deleteMany({ where: { companyId } });
    // 10. Processing jobs
    await this.prisma.processingJob.deleteMany({ where: { companyId } });
    return { deleted: true };
  }

  private buildWhereClause(
    companyId: string,
    query: QueryNotesDto,
  ): Prisma.DeliveryNoteWhereInput {
    const where: Prisma.DeliveryNoteWhereInput = { companyId };

    if (query.status) {
      where.status = {
        in: query.status.split(',') as DeliveryNoteStatus[],
      };
    }
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.supplierName) {
      where.supplierName = {
        contains: query.supplierName,
        mode: 'insensitive',
      };
    }
    if (query.dateFrom || query.dateTo) {
      where.deliveryDate = {};
      if (query.dateFrom)
        (where.deliveryDate as any).gte = new Date(query.dateFrom);
      if (query.dateTo)
        (where.deliveryDate as any).lte = new Date(query.dateTo);
    }
    if (query.source) {
      where.source = { in: query.source.split(',') as any[] };
    }
    if (query.search) {
      where.OR = [
        { supplierName: { contains: query.search, mode: 'insensitive' } },
        { noteNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
