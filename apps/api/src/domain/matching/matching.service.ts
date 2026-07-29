import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueryMatchesDto } from './dto/query-matches.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { AutoMatchService } from './auto-match.service';
import { MatchPostprocessorService } from './match-postprocessor.service';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly autoMatchService: AutoMatchService,
    private readonly matchPostprocessor: MatchPostprocessorService,
  ) {}

  async findAll(companyId: string, query: QueryMatchesDto) {
    const where: Prisma.ThreeWayMatchWhereInput = { companyId };

    if (query.status) {
      where.status = { in: query.status.split(',') };
    }
    if (query.search) {
      where.OR = [
        { purchaseOrder: { supplierName: { contains: query.search, mode: 'insensitive' } } },
        { purchaseOrder: { poNumber: { contains: query.search, mode: 'insensitive' } } },
        { deliveryNotes: { some: { supplierName: { contains: query.search, mode: 'insensitive' } } } },
        { invoices: { some: { supplierName: { contains: query.search, mode: 'insensitive' } } } },
        { invoices: { some: { invoiceNumber: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.threeWayMatch.findMany({
        where,
        include: {
          purchaseOrder: { include: { lineItems: true } },
          deliveryNotes: { include: { lineItems: true } },
          invoices: { include: { lineItems: true } },
        },
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
        skip: ((query.page || 1) - 1) * (query.limit || 20),
        take: query.limit || 20,
      }),
      this.prisma.threeWayMatch.count({ where }),
    ]);

    return {
      data, total,
      page: query.page || 1,
      limit: query.limit || 20,
      totalPages: Math.ceil(total / (query.limit || 20)),
    };
  }

  async findOne(id: string, companyId?: string) {
    const match = await this.prisma.threeWayMatch.findUnique({
      where: { id },
      include: {
        purchaseOrder: { include: { lineItems: { orderBy: { sortOrder: 'asc' } } } },
        deliveryNotes: { include: { lineItems: { orderBy: { sortOrder: 'asc' } } } },
        invoices: { include: { lineItems: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (companyId && match.companyId !== companyId) {
      throw new NotFoundException('Match not found');
    }
    return match;
  }

  async resolve(id: string, userId: string, companyId: string, notes?: string) {
    await this.findOne(id, companyId);
    return this.prisma.threeWayMatch.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: userId, notes },
    });
  }

  async autoMatch(companyId: string, options?: { referenceOnly?: boolean; projectId?: string; supplierId?: string }) {
    return this.autoMatchService.run(companyId, options);
  }

  async submitFeedback(companyId: string, userId: string, dto: SubmitFeedbackDto) {
    return this.prisma.itemMatchFeedback.create({
      data: {
        companyId,
        descriptionA: dto.descriptionA,
        descriptionB: dto.descriptionB,
        catalogNumberA: dto.catalogNumberA ?? undefined,
        catalogNumberB: dto.catalogNumberB ?? undefined,
        sourceDocType: dto.sourceDocType,
        targetDocType: dto.targetDocType,
        threeWayMatchId: dto.threeWayMatchId,
        createdById: userId,
      },
    });
  }

  async deleteAll(companyId: string, deleteFeedback = false) {
    if (deleteFeedback) {
      await this.prisma.itemMatchFeedback.deleteMany({ where: { companyId } });
    } else {
      await this.prisma.itemMatchFeedback.updateMany({
        where: { companyId, threeWayMatchId: { not: null } },
        data: { threeWayMatchId: null },
      });
    }
    const result = await this.prisma.threeWayMatch.deleteMany({ where: { companyId } });
    return { deleted: result.count };
  }

  /**
   * Remove a document (invoice or DN) from its match, delete it, and recompute.
   * If the match becomes empty (no PO, no DNs, no invoices) it is deleted too.
   */
  async removeDocument(
    companyId: string,
    documentId: string,
    documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice',
  ) {
    // Find the match containing this document
    const matchWhere = documentType === 'invoice'
      ? { invoices: { some: { id: documentId } }, companyId }
      : documentType === 'purchaseOrder'
      ? { purchaseOrderId: documentId, companyId }
      : { deliveryNotes: { some: { id: documentId } }, companyId };

    const match = await this.prisma.threeWayMatch.findFirst({
      where: matchWhere,
      include: {
        deliveryNotes: { select: { id: true } },
        invoices: { select: { id: true } },
      },
    });

    // Disconnect from match if linked
    if (match) {
      if (documentType === 'invoice') {
        await this.prisma.threeWayMatch.update({
          where: { id: match.id },
          data: { invoices: { disconnect: { id: documentId } } },
        });
      } else if (documentType === 'purchaseOrder') {
        await this.prisma.threeWayMatch.update({
          where: { id: match.id },
          data: { purchaseOrderId: null },
        });
      } else {
        await this.prisma.threeWayMatch.update({
          where: { id: match.id },
          data: { deliveryNotes: { disconnect: { id: documentId } } },
        });
      }
    }

    // Delete the document (and its line items via cascade)
    if (documentType === 'invoice') {
      const inv = await this.prisma.invoice.findUnique({ where: { id: documentId } });
      if (inv) {
        await this.prisma.invoiceLineItem.deleteMany({ where: { invoiceId: documentId } });
        await this.prisma.invoice.delete({ where: { id: documentId } });
      }
    } else if (documentType === 'purchaseOrder') {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id: documentId } });
      if (po) {
        await this.prisma.pOLineItem.deleteMany({ where: { purchaseOrderId: documentId } });
        await this.prisma.purchaseOrder.delete({ where: { id: documentId } });
      }
    } else {
      const dn = await this.prisma.deliveryNote.findUnique({ where: { id: documentId } });
      if (dn) {
        await this.prisma.lineItem.deleteMany({ where: { deliveryNoteId: documentId } });
        await this.prisma.deliveryNote.delete({ where: { id: documentId } });
      }
    }

    // Check if match is now empty → delete it; otherwise recompute
    if (match) {
      const remaining = await this.prisma.threeWayMatch.findUnique({
        where: { id: match.id },
        include: {
          deliveryNotes: { select: { id: true } },
          invoices: { select: { id: true } },
        },
      });

      if (remaining) {
        const hasContent = remaining.purchaseOrderId ||
          remaining.deliveryNotes.length > 0 ||
          remaining.invoices.length > 0;

        if (!hasContent) {
          await this.prisma.threeWayMatch.delete({ where: { id: match.id } });
          this.logger.log(`Deleted empty match ${match.id} after removing document ${documentId}`);
        } else {
          // Recompute match pairings and status via postprocessor
          const ctx = {
            companyId,
            companyName: null,
            unmatchedPOs: [], unmatchedDNs: [], unmatchedInvoices: [],
            matchedPOSet: new Set<string>(), matchedDNSet: new Set<string>(), matchedInvSet: new Set<string>(),
            created: [] as string[],
            updatedMatchIds: new Set([match.id]),
          };
          await this.matchPostprocessor.recomputeModifiedMatches(ctx);
          this.logger.log(`Recomputed match ${match.id} after removing ${documentType} ${documentId}`);
        }
      }
    }

    return { success: true };
  }

  async recomputeMatch(ctx: {
    companyId: string;
    companyName: string | null;
    unmatchedPOs: string[];
    unmatchedDNs: string[];
    unmatchedInvoices: string[];
    matchedPOSet: Set<string>;
    matchedDNSet: Set<string>;
    matchedInvSet: Set<string>;
    created: string[];
    updatedMatchIds: Set<string>;
  }) {
    return this.matchPostprocessor.recomputeModifiedMatches(ctx);
  }

  async getFeedback(companyId: string) {
    return this.prisma.itemMatchFeedback.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
