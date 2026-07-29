import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import type { EditLineItemDto } from './dto/edit-line-item.dto';
import type { ExceptionActionDto } from './dto/exception-action.dto';
import type { LineItemEditReason } from '@prisma/client';

@Injectable()
export class LineItemEditService {
  private readonly logger = new Logger(LineItemEditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingService: MatchingService,
  ) {}

  private async ensureExists(id: string, companyId?: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (companyId && project.companyId !== companyId) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  /** Find the InvoiceLineItem corresponding to a POLineItem via ThreeWayMatch pairings */
  private findInvoiceLineItem(
    poLineItem: any,
    match: any,
  ): { invoiceLineItem: any; invoiceId: string } | null {
    if (!match) return null;
    const pairings = (match.lineItemPairings as any[]) || [];
    const poDesc = poLineItem.description?.trim() || '';
    const pairing = pairings.find(
      (p: any) =>
        (p?.po?.description?.trim() || '') === poDesc ||
        p?.po?.index === poLineItem.sortOrder,
    );
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

  async editLineItem(
    lineItemId: string,
    dto: EditLineItemDto,
    userId: string,
    companyId: string,
  ) {
    // 1. Try POLineItem first, then DN LineItem
    const poLineItem = await this.prisma.pOLineItem.findUnique({
      where: { id: lineItemId },
      include: { purchaseOrder: true },
    });

    if (!poLineItem) {
      const dnLineItem = await this.prisma.lineItem.findUnique({
        where: { id: lineItemId },
        include: { deliveryNote: true },
      });
      if (dnLineItem) {
        return this.editDnLineItem(dnLineItem, dto, userId, companyId);
      }
      throw new NotFoundException('Line item not found');
    }

    // 2. Find ThreeWayMatch for this PO
    const match = await this.prisma.threeWayMatch.findFirst({
      where: { purchaseOrderId: poLineItem.purchaseOrderId },
      include: {
        deliveryNotes: { select: { id: true, lineItems: true } },
        invoices: { select: { id: true, lineItems: true } },
      },
    });

    const pairings = (match?.lineItemPairings as any[]) || [];
    const poDesc = poLineItem.description?.trim() || '';
    const pairing =
      pairings.find((p: any) => p?.po?.index === poLineItem.sortOrder) ||
      pairings.find((p: any) => (p?.po?.description?.trim() || '') === poDesc);

    // Route by editSource
    const source = dto.editSource || 'invoice';

    if (source === 'po') {
      return this.editPoLineItem(poLineItem, dto, userId, companyId, match);
    }

    if (source === 'dn') {
      // Find the matched DN line item via pairings, then fallback to description/keyword search
      let dnLineItem = this.findDnLineItemFromPairing(pairing, match);
      if (!dnLineItem && match?.deliveryNotes) {
        // Fallback: search all DN line items by description match
        const poWords = poDesc.replace(/[()"/\-,.:;!?]/g, ' ').split(/\s+/).filter((w: string) => w.length >= 3);
        for (const dn of match.deliveryNotes) {
          for (const li of dn.lineItems) {
            const liDesc = (li.description?.trim() || '');
            // Exact match
            if (liDesc === poDesc) { dnLineItem = li; break; }
            // Keyword match (2+ shared words)
            const liWords = liDesc.replace(/[()"/\-,.:;!?]/g, ' ').split(/\s+/).filter((w: string) => w.length >= 3);
            const shared = poWords.filter((w: string) => liWords.some((lw: string) => lw.includes(w) || w.includes(lw)));
            if (shared.length >= 2) { dnLineItem = li; break; }
          }
          if (dnLineItem) break;
        }
      }
      if (dnLineItem) {
        return this.editDnLineItem(dnLineItem, dto, userId, companyId);
      }
      throw new NotFoundException('No matching delivery note line item found');
    }

    // source === 'invoice' (default) — original behavior
    // 3. Find corresponding InvoiceLineItem
    const invResult = this.findInvoiceLineItem(poLineItem, match);

    // 4. Build audit log entries and update invoice line item in a transaction
    const reason = dto.reason as LineItemEditReason;
    const auditEntries: Array<{
      fieldName: string;
      oldValue: string | null;
      newValue: string;
    }> = [];

    if (dto.invoicedQty != null) {
      const oldVal = invResult?.invoiceLineItem
        ? String(Number(invResult.invoiceLineItem.quantity))
        : null;
      auditEntries.push({
        fieldName: 'invoicedQty',
        oldValue: oldVal,
        newValue: String(dto.invoicedQty),
      });
    }
    if (dto.unitPrice != null) {
      const oldVal = invResult?.invoiceLineItem
        ? String(Number(invResult.invoiceLineItem.unitPrice) || 0)
        : null;
      auditEntries.push({
        fieldName: 'unitPrice',
        oldValue: oldVal,
        newValue: String(dto.unitPrice),
      });
    }
    if (dto.unit != null) {
      const oldVal = invResult?.invoiceLineItem?.unit ?? poLineItem.unit ?? null;
      auditEntries.push({
        fieldName: 'unit',
        oldValue: oldVal,
        newValue: dto.unit,
      });
    }

    if (auditEntries.length === 0) {
      throw new NotFoundException('No fields to update');
    }

    this.logger.log(`editLineItem: lineItemId=${lineItemId}, source=invoice, entries=${auditEntries.length}, reason=${reason}`);

    await this.prisma.$transaction(async (tx) => {
      for (const entry of auditEntries) {
        await tx.lineItemAuditLog.create({
          data: {
            companyId,
            poLineItemId: lineItemId,
            invoiceLineItemId: invResult?.invoiceLineItem?.id ?? null,
            matchId: match?.id ?? null,
            fieldName: entry.fieldName,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            reason,
            note: dto.note ?? null,
            editedById: userId,
          },
        });
      }

      if (invResult?.invoiceLineItem) {
        const updateData: any = {};
        if (dto.invoicedQty != null) updateData.quantity = dto.invoicedQty;
        if (dto.unitPrice != null) updateData.unitPrice = dto.unitPrice;
        if (dto.unit != null) updateData.unit = dto.unit;
        if (Object.keys(updateData).length > 0) {
          await tx.invoiceLineItem.update({
            where: { id: invResult.invoiceLineItem.id },
            data: updateData,
          });
        }
      }
    });

    return { success: true };
  }

  /** Edit a PO line item directly (quantity, unitPrice, unit) */
  private async editPoLineItem(
    poLineItem: any,
    dto: EditLineItemDto,
    userId: string,
    companyId: string,
    match: any,
  ) {
    const reason = dto.reason as LineItemEditReason;
    const auditEntries: Array<{ fieldName: string; oldValue: string | null; newValue: string }> = [];

    if (dto.quantity != null) {
      auditEntries.push({
        fieldName: 'orderedQty',
        oldValue: String(Number(poLineItem.quantity) || 0),
        newValue: String(dto.quantity),
      });
    }
    if (dto.unitPrice != null) {
      auditEntries.push({
        fieldName: 'unitPrice',
        oldValue: String(Number(poLineItem.unitPrice) || 0),
        newValue: String(dto.unitPrice),
      });
    }
    if (dto.unit != null) {
      auditEntries.push({
        fieldName: 'unit',
        oldValue: poLineItem.unit ?? null,
        newValue: dto.unit,
      });
    }

    if (auditEntries.length === 0) {
      throw new NotFoundException('No fields to update');
    }

    this.logger.log(`editPoLineItem: id=${poLineItem.id}, entries=${auditEntries.length}, reason=${reason}`);

    await this.prisma.$transaction(async (tx) => {
      for (const entry of auditEntries) {
        await tx.lineItemAuditLog.create({
          data: {
            companyId,
            poLineItemId: poLineItem.id,
            matchId: match?.id ?? null,
            fieldName: entry.fieldName,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            reason,
            note: dto.note ?? null,
            editedById: userId,
          },
        });
      }

      const updateData: any = {};
      if (dto.quantity != null) updateData.quantity = dto.quantity;
      if (dto.unitPrice != null) updateData.unitPrice = dto.unitPrice;
      if (dto.unit != null) updateData.unit = dto.unit;

      await tx.pOLineItem.update({
        where: { id: poLineItem.id },
        data: updateData,
      });
    });

    return { success: true };
  }

  /** Find the DN LineItem from a pairing */
  private findDnLineItemFromPairing(pairing: any, match: any): any | null {
    if (!pairing?.dn || !match?.deliveryNotes) return null;
    const dnDesc = pairing.dn.description?.trim() || '';
    const dnIndex = pairing.dn.index;

    for (const dn of match.deliveryNotes) {
      // Try by index first
      if (dnIndex != null && dn.lineItems[dnIndex]) {
        return dn.lineItems[dnIndex];
      }
      // Fallback by description
      const found = dn.lineItems.find((li: any) => (li.description?.trim() || '') === dnDesc);
      if (found) return found;
    }
    return null;
  }

  /** Edit a DN line item (quantity, unitPrice, unit) */
  private async editDnLineItem(
    dnLineItem: any,
    dto: EditLineItemDto,
    userId: string,
    companyId: string,
  ) {
    const reason = dto.reason as LineItemEditReason;
    const auditEntries: Array<{ fieldName: string; oldValue: string | null; newValue: string }> = [];

    if (dto.quantity != null) {
      auditEntries.push({
        fieldName: 'quantity',
        oldValue: String(Number(dnLineItem.quantity) || 0),
        newValue: String(dto.quantity),
      });
    }
    if (dto.unitPrice != null) {
      auditEntries.push({
        fieldName: 'unitPrice',
        oldValue: dnLineItem.unitPrice != null ? String(Number(dnLineItem.unitPrice)) : null,
        newValue: String(dto.unitPrice),
      });
    }
    if (dto.unit != null) {
      auditEntries.push({
        fieldName: 'unit',
        oldValue: dnLineItem.unit ?? null,
        newValue: dto.unit,
      });
    }

    if (auditEntries.length === 0) {
      throw new NotFoundException('No fields to update');
    }

    this.logger.log(`editDnLineItem: dnLineItemId=${dnLineItem.id}, entries=${auditEntries.length}, reason=${reason}`);

    await this.prisma.$transaction(async (tx) => {
      for (const entry of auditEntries) {
        await tx.lineItemAuditLog.create({
          data: {
            companyId,
            dnLineItemId: dnLineItem.id,
            matchId: null,
            fieldName: entry.fieldName,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            reason,
            note: dto.note ?? null,
            editedById: userId,
          },
        });
      }

      const updateData: any = {};
      if (dto.quantity != null) updateData.quantity = dto.quantity;
      if (dto.unitPrice != null) updateData.unitPrice = dto.unitPrice;
      if (dto.unit != null) updateData.unit = dto.unit;

      await tx.lineItem.update({
        where: { id: dnLineItem.id },
        data: updateData,
      });
    });

    return { success: true };
  }

  async getLineItemAuditTrail(lineItemId: string, companyId?: string) {
    const where: any = {
      OR: [{ poLineItemId: lineItemId }, { dnLineItemId: lineItemId }],
    };
    if (companyId) {
      where.companyId = companyId;
    }
    const logs = await this.prisma.lineItemAuditLog.findMany({
      where,
      include: {
        editedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return logs.map((log) => ({
      id: log.id,
      fieldName: log.fieldName,
      oldValue: log.oldValue,
      newValue: log.newValue,
      reason: log.reason,
      note: log.note,
      editedBy: { name: log.editedBy.name, email: log.editedBy.email },
      createdAt: log.createdAt.toISOString(),
    }));
  }

  async resolveException(
    lineItemId: string,
    dto: ExceptionActionDto,
    userId: string,
    companyId: string,
  ) {
    // Try PO line item first (default/orders view)
    let poLineItem = await this.prisma.pOLineItem.findUnique({
      where: { id: lineItemId },
      include: { purchaseOrder: true },
    });

    let match: any = null;
    let resolvedPoLineItemId = lineItemId;
    let invoiceLineItemId: string | null = null;

    if (poLineItem) {
      match = await this.prisma.threeWayMatch.findFirst({
        where: { purchaseOrderId: poLineItem.purchaseOrderId },
        include: {
          deliveryNotes: { include: { lineItems: true } },
          invoices: { select: { id: true, lineItems: true } },
        },
      });
    } else {
      // Fallback: lineItemId might be an invoice or DN line item (from invoice/DN view)
      const invLineItem = await this.prisma.invoiceLineItem.findUnique({
        where: { id: lineItemId },
        include: { invoice: true },
      });
      if (invLineItem) {
        invoiceLineItemId = lineItemId;
        match = await this.prisma.threeWayMatch.findFirst({
          where: { invoices: { some: { id: invLineItem.invoiceId } } },
          include: {
            purchaseOrder: { include: { lineItems: true } },
            deliveryNotes: { include: { lineItems: true } },
            invoices: { select: { id: true, lineItems: true } },
          },
        });
        // Find corresponding PO line item via pairings
        const pairings = (match?.lineItemPairings as any[]) || [];
        const invPairing = pairings.find((p: any) => p?.inv?.index === invLineItem.sortOrder);
        if (invPairing?.po && match?.purchaseOrder) {
          poLineItem = match.purchaseOrder.lineItems.find(
            (pli: any) => pli.sortOrder === invPairing.po.index,
          ) || null;
          if (poLineItem) resolvedPoLineItemId = poLineItem.id;
        }
      } else {
        // Try DN line item
        const dnLineItem = await this.prisma.lineItem.findUnique({
          where: { id: lineItemId },
          include: { deliveryNote: true },
        });
        if (!dnLineItem) throw new NotFoundException('Line item not found');
        match = await this.prisma.threeWayMatch.findFirst({
          where: { deliveryNotes: { some: { id: dnLineItem.deliveryNoteId } } },
          include: {
            purchaseOrder: { include: { lineItems: true } },
            deliveryNotes: { include: { lineItems: true } },
            invoices: { select: { id: true, lineItems: true } },
          },
        });
        const pairings = (match?.lineItemPairings as any[]) || [];
        const dnPairing = pairings.find((p: any) => p?.dn?.index === dnLineItem.sortOrder);
        if (dnPairing?.po && match?.purchaseOrder) {
          poLineItem = match.purchaseOrder.lineItems.find(
            (pli: any) => pli.sortOrder === dnPairing.po.index,
          ) || null;
          if (poLineItem) resolvedPoLineItemId = poLineItem.id;
        }
      }
    }

    // Compute receivedQty from delivery notes using same logic as buildLineItem
    let receivedQty = 0;
    const pairings = (match?.lineItemPairings as any[]) || [];
    const poDesc = (poLineItem?.description || '').trim().toLowerCase();
    const pairing = pairings.find(
      (p: any) => (p?.po?.description?.trim().toLowerCase() || '') === poDesc,
    );

    if (pairing?.dn) {
      for (const dn of match?.deliveryNotes || []) {
        const dnItem = dn.lineItems[pairing.dn.index];
        if (dnItem) receivedQty += Number(dnItem.quantity) || 0;
      }
    }

    // Get current invoiced amount for audit trail
    const invResult = poLineItem ? this.findInvoiceLineItem(poLineItem, match) : null;
    const oldInvoicedQty = invResult?.invoiceLineItem
      ? String(Number(invResult.invoiceLineItem.quantity))
      : null;

    const reason = dto.type as LineItemEditReason;

    // poLineItemId FK must reference an actual PO line item or be null
    const auditPoLineItemId = poLineItem ? resolvedPoLineItemId : null;

    await this.prisma.lineItemAuditLog.create({
      data: {
        companyId,
        poLineItemId: auditPoLineItemId,
        invoiceLineItemId: invoiceLineItemId ?? invResult?.invoiceLineItem?.id ?? null,
        matchId: match?.id ?? null,
        fieldName: 'invoicedQty',
        oldValue: oldInvoicedQty,
        newValue: String(receivedQty),
        reason,
        note: dto.note ?? null,
        editedById: userId,
      },
    });

    return { success: true };
  }

  async deleteLineItem(
    lineItemId: string,
    documentType: 'dn' | 'invoice',
    companyId: string,
  ) {
    if (documentType === 'dn') {
      const dnLineItem = await this.prisma.lineItem.findUnique({
        where: { id: lineItemId },
        include: { deliveryNote: true },
      });
      if (!dnLineItem) throw new NotFoundException('DN line item not found');

      const match = await this.prisma.threeWayMatch.findFirst({
        where: { deliveryNotes: { some: { id: dnLineItem.deliveryNoteId } }, companyId },
      });

      await this.prisma.lineItem.delete({ where: { id: lineItemId } });
      this.logger.log(`Deleted DN line item ${lineItemId}`);

      if (match) {
        await this.recomputeMatch(match.id, companyId);
      }
      return { success: true, matchId: match?.id ?? null };
    }

    // invoice
    const invLineItem = await this.prisma.invoiceLineItem.findUnique({
      where: { id: lineItemId },
      include: { invoice: true },
    });
    if (!invLineItem) throw new NotFoundException('Invoice line item not found');

    const match = await this.prisma.threeWayMatch.findFirst({
      where: { invoices: { some: { id: invLineItem.invoiceId } }, companyId },
    });

    await this.prisma.invoiceLineItem.delete({ where: { id: lineItemId } });
    this.logger.log(`Deleted invoice line item ${lineItemId}`);

    if (match) {
      await this.recomputeMatch(match.id, companyId);
    }
    return { success: true, matchId: match?.id ?? null };
  }

  private async recomputeMatch(matchId: string, companyId: string) {
    const ctx = {
      companyId,
      companyName: null,
      unmatchedPOs: [] as string[],
      unmatchedDNs: [] as string[],
      unmatchedInvoices: [] as string[],
      matchedPOSet: new Set<string>(),
      matchedDNSet: new Set<string>(),
      matchedInvSet: new Set<string>(),
      created: [] as string[],
      updatedMatchIds: new Set([matchId]),
    };
    await this.matchingService.recomputeMatch(ctx);
  }

  async getProjectQuotes(projectId: string, companyId?: string) {
    await this.ensureExists(projectId, companyId);
    const quotes = await this.prisma.purchaseOrder.findMany({
      where: { projectId, isQuote: true },
      select: {
        id: true, poNumber: true, supplierName: true,
        quoteReference: true, orderDate: true, totalAmount: true,
        currency: true, originalFileUrl: true,
        lineItems: {
          select: { description: true, quantity: true, unit: true, unitPrice: true, totalPrice: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return quotes.map((q) => ({
      ...q,
      totalAmount: Number(q.totalAmount) || 0,
      lineItems: q.lineItems.map((li) => ({
        ...li,
        quantity: Number(li.quantity) || 0,
        unitPrice: Number(li.unitPrice) || 0,
        totalPrice: Number(li.totalPrice) || 0,
      })),
    }));
  }
}
