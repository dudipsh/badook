import { Injectable, Logger, ConflictException } from '@nestjs/common';
import * as path from 'path';
import { DeliveryNotesService } from '../../domain/delivery-notes/delivery-notes.service';
import { PurchaseOrdersService } from '../../domain/purchase-orders/purchase-orders.service';
import { InvoicesService } from '../../domain/invoices/invoices.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { ScanLogger } from '../../infrastructure/jobs/scan-logger.service';
import { compressDocument } from '../../utils/compress-document';
import type { AgentContext, ExtractionResult } from './agent.types';
import type { ParsedDeliveryNote, ParsedInvoice, ParsedPurchaseOrder } from '../ocr/ocr.types';
import { inferUnitFromDescription } from '../../domain/matching/unit-utils';

@Injectable()
export class DocumentSaverService {
  private readonly logger = new Logger(DocumentSaverService.name);

  constructor(
    private readonly deliveryNotes: DeliveryNotesService,
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly invoices: InvoicesService,
    private readonly storage: StorageService,
    private readonly scanLogger: ScanLogger,
  ) {}

  /** Early duplicate check — returns a user-facing message if duplicate found, null otherwise */
  async checkDuplicate(companyId: string, extraction: ExtractionResult): Promise<string | null> {
    switch (extraction.documentType) {
      case 'invoice': {
        const parsed = extraction.parsedData as ParsedInvoice;
        if (parsed.invoiceNumber) {
          const existing = await this.invoices.findDuplicate(parsed.invoiceNumber, companyId);
          if (existing) return `חשבונית מספר ${parsed.invoiceNumber} כבר קיימת במערכת`;
        }
        return null;
      }
      case 'purchase_order': {
        const parsed = extraction.parsedData as ParsedPurchaseOrder;
        if (parsed.poNumber) {
          const existing = await this.purchaseOrders.findDuplicate(parsed.poNumber, companyId);
          if (existing) return `הזמנת רכש מספר ${parsed.poNumber} כבר קיימת במערכת`;
        }
        return null;
      }
      case 'delivery_note':
      default: {
        const parsed = extraction.parsedData as ParsedDeliveryNote;
        if (parsed.noteNumber) {
          const existing = await this.deliveryNotes.findDuplicate(parsed.noteNumber, companyId);
          if (existing) return `תעודת משלוח מספר ${parsed.noteNumber} כבר קיימת במערכת`;
        }
        return null;
      }
    }
  }

  async saveDocument(
    context: AgentContext,
    documentType: string,
    parsedData: ParsedDeliveryNote | ParsedInvoice | ParsedPurchaseOrder,
    projectId: string | null,
  ): Promise<{ id: string }> {
    switch (documentType) {
      case 'invoice': {
        const parsed = parsedData as ParsedInvoice;
        if (parsed.invoiceNumber) {
          const existing = await this.invoices.findDuplicate(parsed.invoiceNumber, context.companyId);
          if (existing) {
            if (context.force) {
              await this.invoices.delete(existing.id);
            } else {
              throw new ConflictException(`חשבונית מספר ${parsed.invoiceNumber} כבר קיימת במערכת`);
            }
          }
        }
        const result = await this.invoices.createFromParsed({
          supplierName: parsed.supplierName || 'Unknown',
          companyId: context.companyId,
          source: context.source,
          originalFileUrl: context.filePath,
          parsedData: context.emailScanLogId ? { ...parsed, _scanLogId: context.emailScanLogId } : parsed,
          invoiceNumber: parsed.invoiceNumber ?? undefined,
          invoiceDate: parsed.invoiceDate ?? undefined,
          dueDate: parsed.dueDate ?? undefined,
          totalAmount: parsed.totalAmount ?? undefined,
          vatAmount: parsed.vatAmount ?? undefined,
          supplierDetails: {
            phone: parsed.supplierPhone ?? undefined,
            address: parsed.supplierAddress ?? undefined,
            businessId: parsed.supplierBusinessId ?? undefined,
          },
          lineItems: (parsed.lineItems || []).map((item) => ({
            description: item.description,
            catalogNumber: item.catalogNumber ?? undefined,
            quantity: item.quantity,
            unit: inferUnitFromDescription(item.description, item.unit) ?? undefined,
            unitPrice: item.unitPrice ?? undefined,
            totalPrice: item.totalPrice ?? undefined,
            discountPercent: item.discountPercent ?? undefined,
            discountAmount: item.discountAmount ?? undefined,
            priceBeforeDiscount: item.priceBeforeDiscount ?? undefined,
          })),
          createdById: context.userId,
          projectId: projectId ?? undefined,
        });

        return result;
      }

      case 'purchase_order': {
        const parsed = parsedData as ParsedPurchaseOrder;
        if (parsed.poNumber) {
          const existing = await this.purchaseOrders.findDuplicate(parsed.poNumber, context.companyId);
          if (existing) {
            if (context.force) {
              await this.purchaseOrders.delete(existing.id);
            } else {
              throw new ConflictException(`הזמנת רכש מספר ${parsed.poNumber} כבר קיימת במערכת`);
            }
          }
        }
        const po = await this.purchaseOrders.createFromParsed({
          supplierName: parsed.supplierName || 'Unknown',
          companyId: context.companyId,
          source: context.source,
          originalFileUrl: context.filePath,
          parsedData: context.emailScanLogId ? { ...parsed, _scanLogId: context.emailScanLogId } : parsed,
          poNumber: parsed.poNumber ?? undefined,
          orderDate: parsed.orderDate ?? undefined,
          totalAmount: parsed.totalAmount ?? undefined,
          quoteReference: parsed.quoteReference ?? undefined,
          isQuote: parsed.documentSubtype === 'price_quote' &&
            !/^(PO|PQ|הזמנ)/i.test(parsed.poNumber || ''),
          supplierDetails: {
            phone: parsed.supplierPhone ?? undefined,
            address: parsed.supplierAddress ?? undefined,
            businessId: parsed.supplierBusinessId ?? undefined,
          },
          lineItems: (parsed.lineItems || []).map((item) => ({
            description: item.description,
            catalogNumber: item.catalogNumber ?? undefined,
            quantity: item.quantity,
            unit: inferUnitFromDescription(item.description, item.unit) ?? undefined,
            unitPrice: item.unitPrice ?? undefined,
            totalPrice: item.totalPrice ?? undefined,
            discountPercent: item.discountPercent ?? undefined,
            discountAmount: item.discountAmount ?? undefined,
            priceBeforeDiscount: item.priceBeforeDiscount ?? undefined,
            remarks: item.remarks ?? undefined,
            expectedDeliveryDate: item.expectedDeliveryDate ?? undefined,
          })),
          createdById: context.userId,
          projectId: projectId ?? undefined,
        });
        if (!po) {
          // PO could not be saved (invalid/missing PO number) — save as orphan delivery note to preserve the document
          this.logger.warn(`PO save returned null for poNumber "${parsed.poNumber}" — saving as orphan`);
          this.scanLogger.log(context.companyId, 'pipeline', `הזמנת רכש עם מספר חסר/לא תקין "${parsed.poNumber}" — נשמר כמסמך יתום`);
          return this.deliveryNotes.createFromParsed({
            supplierName: parsed.supplierName || 'Unknown',
            companyId: context.companyId,
            source: context.source,
            originalFileUrl: context.filePath,
            parsedData: { ...parsed, _failedAsPO: true, _originalPoNumber: parsed.poNumber } as any,
            parsingConfidence: parsed.confidence ?? 0.3,
            lineItems: (parsed.lineItems || []).map((item) => ({
              description: item.description,
              catalogNumber: item.catalogNumber ?? undefined,
              quantity: item.quantity,
              unit: item.unit ?? undefined,
              unitPrice: item.unitPrice ?? undefined,
              totalPrice: item.totalPrice ?? undefined,
            })),
            createdById: context.userId,
            projectId: projectId ?? undefined,
          });
        }
        return po;
      }

      case 'delivery_note':
      default: {
        const parsed = parsedData as ParsedDeliveryNote;
        if (parsed.noteNumber) {
          const existing = await this.deliveryNotes.findDuplicate(parsed.noteNumber, context.companyId);
          if (existing) {
            if (context.force) {
              await this.deliveryNotes.delete(existing.id);
            } else {
              throw new ConflictException(`תעודת משלוח מספר ${parsed.noteNumber} כבר קיימת במערכת`);
            }
          }
        }
        return this.deliveryNotes.createFromParsed({
          supplierName: parsed.supplierName || 'Unknown',
          companyId: context.companyId,
          source: context.source,
          originalFileUrl: context.filePath,
          originalFileName: context.originalFileName,
          parsedData: parsed,
          parsingConfidence: parsed.confidence ?? 0,
          noteNumber: parsed.noteNumber ?? undefined,
          deliveryDate: parsed.deliveryDate ?? undefined,
          totalAmount: parsed.totalAmount ?? undefined,
          vatAmount: parsed.vatAmount ?? undefined,
          supplierDetails: {
            phone: parsed.supplierPhone ?? undefined,
            address: parsed.supplierAddress ?? undefined,
            businessId: parsed.supplierBusinessId ?? undefined,
          },
          lineItems: (parsed.lineItems || []).map((item, idx) => {
            const rejected = (parsed.rejectedItems || []).find((r) => r.index === idx);
            return {
              description: item.description,
              catalogNumber: item.catalogNumber ?? undefined,
              quantity: item.quantity,
              unit: inferUnitFromDescription(item.description, item.unit) ?? undefined,
              unitPrice: item.unitPrice ?? undefined,
              totalPrice: item.totalPrice ?? undefined,
              discountPercent: item.discountPercent ?? undefined,
              discountAmount: item.discountAmount ?? undefined,
              priceBeforeDiscount: item.priceBeforeDiscount ?? undefined,
              delivered: !rejected,
              receivedQuantity: item.receivedQuantity ?? undefined,
              handwrittenNotes: rejected ? rejected.reason : (item.handwrittenNotes ?? undefined),
              quantityBreakdown: item.quantityBreakdown ?? undefined,
            };
          }),
          emailScanLogId: context.emailScanLogId,
          createdById: context.userId,
          projectName: parsed.projectName ?? undefined,
          projectId: projectId ?? undefined,
        });
      }
    }
  }

  /** Save a duplicate document as an orphan with a modified number so it appears in the unmatched list */
  async saveDuplicateAsOrphan(
    context: AgentContext,
    extraction: ExtractionResult,
    duplicateMessage: string,
  ): Promise<{ id: string }> {
    const clonedData = JSON.parse(JSON.stringify(extraction.parsedData));
    const suffix = ' (כפול)';

    switch (extraction.documentType) {
      case 'invoice':
        clonedData.invoiceNumber = (clonedData.invoiceNumber || '') + suffix;
        break;
      case 'purchase_order':
        clonedData.poNumber = (clonedData.poNumber || '') + suffix;
        break;
      default:
        clonedData.noteNumber = (clonedData.noteNumber || '') + suffix;
    }

    clonedData._isDuplicate = true;
    clonedData._duplicateMessage = duplicateMessage;

    return this.saveDocument(context, extraction.documentType, clonedData, null);
  }

  async compressAndPreserveOriginal(filePath: string, documentType: string, documentId: string): Promise<void> {
    try {
      const buffer = await this.storage.getBuffer(filePath);
      const result = await compressDocument(buffer, filePath);

      // Build compressed file key with _compressed suffix
      const currentExt = path.extname(filePath).toLowerCase();
      const baseName = filePath.replace(new RegExp(`\\${currentExt}$`, 'i'), '');
      const compressedKey = `${baseName}_compressed${result.ext}`;

      // Upload compressed version alongside original
      await this.storage.uploadWithKey(result.buffer, compressedKey);

      // Update DB: main URL → compressed, HQ URL → original
      switch (documentType) {
        case 'delivery_note':
          await this.deliveryNotes.updateFileUrls(documentId, compressedKey, filePath);
          break;
        case 'invoice':
          await this.invoices.updateFileUrls(documentId, compressedKey, filePath);
          break;
        case 'purchase_order':
          await this.purchaseOrders.updateFileUrls(documentId, compressedKey, filePath);
          break;
      }

      const savings = Math.round((1 - result.buffer.length / buffer.length) * 100);
      this.logger.log(`Compressed ${path.basename(filePath)}: ${(buffer.length / 1024).toFixed(0)}KB → ${(result.buffer.length / 1024).toFixed(0)}KB (${savings}% saved). Original preserved.`);
    } catch (err) {
      this.logger.warn(`Image compression failed for ${filePath}: ${err}`);
    }
  }
}
