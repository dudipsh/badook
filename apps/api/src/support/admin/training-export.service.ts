import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';

export interface ExportSummary {
  companyId: string;
  companyName: string;
  totals: { deliveryNotes: number; invoices: number; purchaseOrders: number };
  uploaded: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const DOC_TYPE = {
  DELIVERY_NOTE: 'DELIVERY_NOTE',
  INVOICE: 'INVOICE',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
} as const;

@Injectable()
export class TrainingExportService {
  private readonly logger = new Logger(TrainingExportService.name);
  private readonly labelingApiUrl: string;
  private readonly labelingApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    this.labelingApiUrl = this.config.get<string>('LABELING_API_URL') || '';
    this.labelingApiKey = this.config.get<string>('LABELING_API_KEY') || '';
  }

  async exportCompany(companyId: string): Promise<ExportSummary> {
    if (!this.labelingApiUrl || !this.labelingApiKey) {
      throw new BadRequestException(
        'LABELING_API_URL and LABELING_API_KEY must be configured to export to training lab',
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });
    if (!company) throw new BadRequestException(`Company ${companyId} not found`);

    const summary: ExportSummary = {
      companyId: company.id,
      companyName: company.name,
      totals: { deliveryNotes: 0, invoices: 0, purchaseOrders: 0 },
      uploaded: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const [deliveryNotes, invoices, purchaseOrders] = await Promise.all([
      this.prisma.deliveryNote.findMany({
        where: { companyId, parsedData: { not: 'null' as any }, originalFileUrl: { not: '' } },
        select: { id: true, originalFileUrl: true, originalFileName: true, parsedData: true },
      }),
      this.prisma.invoice.findMany({
        where: { companyId, parsedData: { not: 'null' as any }, originalFileUrl: { not: null } },
        select: { id: true, originalFileUrl: true, parsedData: true, invoiceNumber: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { companyId, parsedData: { not: 'null' as any }, originalFileUrl: { not: null } },
        select: { id: true, originalFileUrl: true, parsedData: true, poNumber: true },
      }),
    ]);

    summary.totals.deliveryNotes = deliveryNotes.length;
    summary.totals.invoices = invoices.length;
    summary.totals.purchaseOrders = purchaseOrders.length;

    this.logger.log(
      `[export-to-training] company=${company.name} dn=${deliveryNotes.length} inv=${invoices.length} po=${purchaseOrders.length}`,
    );

    for (const dn of deliveryNotes) {
      await this.uploadOne(
        dn.originalFileUrl,
        dn.originalFileName || `dn-${dn.id}`,
        dn.parsedData as Record<string, unknown>,
        DOC_TYPE.DELIVERY_NOTE,
        summary,
      );
    }
    for (const inv of invoices) {
      if (!inv.originalFileUrl) {
        summary.skipped++;
        continue;
      }
      await this.uploadOne(
        inv.originalFileUrl,
        `inv-${inv.invoiceNumber || inv.id}`,
        inv.parsedData as Record<string, unknown>,
        DOC_TYPE.INVOICE,
        summary,
      );
    }
    for (const po of purchaseOrders) {
      if (!po.originalFileUrl) {
        summary.skipped++;
        continue;
      }
      await this.uploadOne(
        po.originalFileUrl,
        `po-${po.poNumber || po.id}`,
        po.parsedData as Record<string, unknown>,
        DOC_TYPE.PURCHASE_ORDER,
        summary,
      );
    }

    this.logger.log(
      `[export-to-training] DONE company=${company.name} uploaded=${summary.uploaded} skipped=${summary.skipped} failed=${summary.failed}`,
    );
    return summary;
  }

  private async uploadOne(
    fileKey: string,
    originalFileName: string,
    groundTruth: Record<string, unknown>,
    documentType: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER',
    summary: ExportSummary,
  ): Promise<void> {
    if (!fileKey || !groundTruth) {
      summary.skipped++;
      return;
    }
    try {
      const buffer = await this.storage.getBuffer(fileKey);
      const ext = this.extFromKey(fileKey);
      const mime = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';

      const form = new FormData();
      const blob = new Blob([new Uint8Array(buffer)], { type: mime });
      form.append('file', blob, `${originalFileName}${ext}`);
      form.append('documentType', documentType);
      form.append('originalFileName', `${originalFileName}${ext}`);
      form.append('groundTruth', JSON.stringify(groundTruth));

      const res = await fetch(`${this.labelingApiUrl}/samples/import`, {
        method: 'POST',
        headers: { 'x-api-key': this.labelingApiKey },
        body: form,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      summary.uploaded++;
    } catch (err) {
      summary.failed++;
      const msg = `${documentType}:${originalFileName} → ${(err as Error).message}`;
      if (summary.errors.length < 20) summary.errors.push(msg);
      this.logger.warn(`[export-to-training] ${msg}`);
    }
  }

  private extFromKey(key: string): string {
    const m = key.match(/\.(pdf|png|jpe?g|webp|tiff?)$/i);
    return m ? `.${m[1].toLowerCase()}` : '.jpg';
  }
}
