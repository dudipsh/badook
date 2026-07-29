import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LineItemPairing, Discrepancy } from '../../domain/matching/matching.types';

export interface DiscrepancyPairingRow {
  matchId: string;
  pairingIndex: number;
  pairing: LineItemPairing;
  supplierName: string;
  projectName: string;
  projectId: string | null;
  discrepancies: Discrepancy[];
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  async getDiscrepancies(
    companyId: string,
    page: number,
    limit: number,
    search?: string,
    projectId?: string,
    severity?: string,
  ) {
    const where: Prisma.ThreeWayMatchWhereInput = {
      companyId,
      lineItemPairings: { not: Prisma.JsonNull },
      status: { not: 'RESOLVED' },
    };

    if (projectId) {
      where.OR = [
        { purchaseOrder: { projectId } },
        { deliveryNotes: { some: { projectId } } },
        { invoices: { some: { projectId } } },
      ];
    }

    const matches = await this.prisma.threeWayMatch.findMany({
      where,
      include: {
        purchaseOrder: {
          select: {
            poNumber: true,
            supplierName: true,
            project: { select: { id: true, name: true } },
          },
        },
        deliveryNotes: {
          select: {
            noteNumber: true,
            supplierName: true,
            project: { select: { id: true, name: true } },
          },
        },
        invoices: {
          select: {
            invoiceNumber: true,
            supplierName: true,
            project: { select: { id: true, name: true } },
          },
        },
        feedbacks: {
          select: { pairingIndex: true, feedbackType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const allPairings: DiscrepancyPairingRow[] = [];

    for (const match of matches) {
      const pairings = (match.lineItemPairings as unknown as LineItemPairing[]) || [];
      const discrepancies = (match.discrepancies as unknown as Discrepancy[]) || [];
      const reviewedIndices = new Set(
        match.feedbacks
          .filter((f) => f.pairingIndex !== null)
          .map((f) => f.pairingIndex),
      );

      const supplierName =
        match.purchaseOrder?.supplierName ||
        match.deliveryNotes[0]?.supplierName ||
        match.invoices[0]?.supplierName ||
        '';

      const project =
        match.purchaseOrder?.project ||
        match.deliveryNotes[0]?.project ||
        match.invoices[0]?.project ||
        null;

      for (let i = 0; i < pairings.length; i++) {
        if (reviewedIndices.has(i)) continue;

        const pairing = pairings[i];
        const isLowConfidence =
          pairing.matchSource === 'ai' || pairing.matchSource === 'ai_second_round' || pairing.matchSource === 'description';
        const description =
          pairing.po?.description ||
          pairing.dn?.description ||
          pairing.inv?.description ||
          '';

        const relevantDiscrepancies = discrepancies.filter(
          (d) =>
            d.field?.includes(description) ||
            (pairing.po?.catalogNumber &&
              d.field?.includes(pairing.po.catalogNumber)),
        );
        const hasDiscrepancy = relevantDiscrepancies.length > 0;

        // Only show AI/description matches or items with discrepancies
        if (!isLowConfidence && !hasDiscrepancy) continue;

        // Apply search filter
        if (
          search &&
          !description.toLowerCase().includes(search.toLowerCase()) &&
          !supplierName.toLowerCase().includes(search.toLowerCase())
        )
          continue;

        const maxSeverity = this.getMaxSeverity(relevantDiscrepancies);

        // Apply severity filter
        if (severity && maxSeverity !== severity) continue;

        allPairings.push({
          matchId: match.id,
          pairingIndex: i,
          pairing,
          supplierName,
          projectName: project?.name || '',
          projectId: project?.id || null,
          discrepancies: relevantDiscrepancies,
          severity: maxSeverity,
        });
      }
    }

    const total = allPairings.length;
    const paginated = allPairings.slice((page - 1) * limit, page * limit);

    return { data: paginated, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async approvePairing(
    companyId: string,
    userId: string,
    matchId: string,
    pairingIndex: number,
  ) {
    const pairing = await this.getPairingFromMatch(companyId, matchId, pairingIndex);

    const descA = pairing.po?.description || pairing.dn?.description || '';
    const descB = pairing.dn?.description || pairing.inv?.description || '';

    return this.prisma.itemMatchFeedback.create({
      data: {
        companyId,
        descriptionA: descA,
        descriptionB: descB,
        catalogNumberA: pairing.po?.catalogNumber ?? undefined,
        catalogNumberB: pairing.dn?.catalogNumber ?? pairing.inv?.catalogNumber ?? undefined,
        sourceDocType: pairing.po ? 'PURCHASE_ORDER' : 'DELIVERY_NOTE',
        targetDocType: pairing.inv ? 'INVOICE' : 'DELIVERY_NOTE',
        threeWayMatchId: matchId,
        createdById: userId,
        feedbackType: 'APPROVED',
        pairingIndex,
      },
    });
  }

  async rejectPairing(
    companyId: string,
    userId: string,
    matchId: string,
    pairingIndex: number,
  ) {
    const pairing = await this.getPairingFromMatch(companyId, matchId, pairingIndex);

    const descA = pairing.po?.description || pairing.dn?.description || '';
    const descB = pairing.dn?.description || pairing.inv?.description || '';

    return this.prisma.itemMatchFeedback.create({
      data: {
        companyId,
        descriptionA: descA,
        descriptionB: descB,
        catalogNumberA: pairing.po?.catalogNumber ?? undefined,
        catalogNumberB: pairing.dn?.catalogNumber ?? pairing.inv?.catalogNumber ?? undefined,
        sourceDocType: pairing.po ? 'PURCHASE_ORDER' : 'DELIVERY_NOTE',
        targetDocType: pairing.inv ? 'INVOICE' : 'DELIVERY_NOTE',
        threeWayMatchId: matchId,
        createdById: userId,
        feedbackType: 'REJECTED',
        pairingIndex,
      },
    });
  }

  async editMapping(
    companyId: string,
    userId: string,
    matchId: string,
    pairingIndex: number,
    descriptionA: string,
    descriptionB: string,
    catalogNumberA?: string,
    catalogNumberB?: string,
  ) {
    // Verify the match exists
    await this.getPairingFromMatch(companyId, matchId, pairingIndex);

    return this.prisma.itemMatchFeedback.create({
      data: {
        companyId,
        descriptionA,
        descriptionB,
        catalogNumberA: catalogNumberA ?? undefined,
        catalogNumberB: catalogNumberB ?? undefined,
        sourceDocType: 'PURCHASE_ORDER',
        targetDocType: 'DELIVERY_NOTE',
        threeWayMatchId: matchId,
        createdById: userId,
        feedbackType: 'MANUAL',
        pairingIndex,
      },
    });
  }

  async getFeedback(
    companyId: string,
    page: number,
    limit: number,
    search?: string,
    feedbackType?: string,
  ) {
    const where: Prisma.ItemMatchFeedbackWhereInput = { companyId };

    if (feedbackType) {
      where.feedbackType = feedbackType;
    }

    if (search) {
      where.OR = [
        { descriptionA: { contains: search, mode: 'insensitive' } },
        { descriptionB: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.itemMatchFeedback.findMany({
        where,
        include: { createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.itemMatchFeedback.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createFeedback(
    companyId: string,
    userId: string,
    descriptionA: string,
    descriptionB: string,
    sourceDocType: string,
    targetDocType: string,
    catalogNumberA?: string,
    catalogNumberB?: string,
  ) {
    return this.prisma.itemMatchFeedback.create({
      data: {
        companyId,
        descriptionA,
        descriptionB,
        catalogNumberA: catalogNumberA ?? undefined,
        catalogNumberB: catalogNumberB ?? undefined,
        sourceDocType,
        targetDocType,
        createdById: userId,
        feedbackType: 'MANUAL',
      },
      include: { createdBy: { select: { name: true } } },
    });
  }

  async updateFeedback(
    id: string,
    companyId: string,
    dto: {
      descriptionA?: string;
      descriptionB?: string;
      catalogNumberA?: string;
      catalogNumberB?: string;
    },
  ) {
    const existing = await this.prisma.itemMatchFeedback.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('Feedback not found');

    return this.prisma.itemMatchFeedback.update({
      where: { id },
      data: dto,
      include: { createdBy: { select: { name: true } } },
    });
  }

  async deleteFeedback(id: string, companyId: string) {
    const existing = await this.prisma.itemMatchFeedback.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('Feedback not found');

    return this.prisma.itemMatchFeedback.delete({ where: { id } });
  }

  private async getPairingFromMatch(
    companyId: string,
    matchId: string,
    pairingIndex: number,
  ): Promise<LineItemPairing> {
    const match = await this.prisma.threeWayMatch.findFirst({
      where: { id: matchId, companyId },
    });
    if (!match) throw new NotFoundException('Match not found');

    const pairings = (match.lineItemPairings as unknown as LineItemPairing[]) || [];
    const pairing = pairings[pairingIndex];
    if (!pairing) throw new NotFoundException('Pairing not found');

    return pairing;
  }

  private getMaxSeverity(discrepancies: Discrepancy[]): 'INFO' | 'WARNING' | 'CRITICAL' {
    if (discrepancies.some((d) => d.severity === 'CRITICAL')) return 'CRITICAL';
    if (discrepancies.some((d) => d.severity === 'WARNING')) return 'WARNING';
    return 'INFO';
  }
}
