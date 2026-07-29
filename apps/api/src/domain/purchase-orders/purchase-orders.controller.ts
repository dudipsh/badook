import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Logger,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PoPdfGenerator } from './po-pdf-generator';
import { MatchingService } from '../matching/matching.service';
import { OcrService } from '../../intelligence/ocr/ocr.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { JobsGateway } from '../../infrastructure/jobs/jobs.gateway';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QueryPODto } from './dto/query-po.dto';
import { CreatePODto } from './dto/create-po.dto';
import { UpdatePODto } from './dto/update-po.dto';

const ALLOWED_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

@Controller('purchase-orders')
@UseGuards(AuthGuard)
export class PurchaseOrdersController {
  private readonly logger = new Logger(PurchaseOrdersController.name);

  constructor(
    private readonly service: PurchaseOrdersService,
    private readonly pdfGenerator: PoPdfGenerator,
    private readonly matching: MatchingService,
    private readonly ocr: OcrService,
    private readonly storage: StorageService,
    private readonly gateway: JobsGateway,
  ) {}

  @Get()
  findAll(
    @CurrentUser('companyId') companyId: string,
    @Query() query: QueryPODto,
  ) {
    return this.service.findAll(companyId, query);
  }

  /**
   * Extract data from a vendor quote file (PDF/image) without saving.
   * Used by the "Create PO" modal to pre-fill the form from an uploaded quote.
   */
  @Post('extract-quote')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, ALLOWED_MIMES.includes(file.mimetype));
      },
    }),
  )
  async extractQuote(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('companyId') companyId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    this.logger.log(`[OCR-DEBUG] [API-RESPONSE] extractQuote START: "${originalName}"`);
    const savedPath = await this.storage.upload(file.buffer, originalName, companyId);

    // Detect document type first — the uploaded file might be a DN or invoice,
    // where supplier/customer roles are inverted compared to a PO.
    // PO: header = buyer, "לכבוד" = supplier
    // DN/invoice: header = supplier, "לכבוד" = customer
    const detected = await this.ocr.detectDocumentType(savedPath, companyId, originalName);
    this.logger.log(`[OCR-DEBUG] [API-RESPONSE] "${originalName}" detected as: ${detected.documentType}`);

    const mapLineItems = (items: any[]) => (items || []).map((item: any) => ({
      description: item.description,
      catalogNumber: item.catalogNumber,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      discountPercent: item.discountPercent,
    }));

    const logResponse = (name: string, lineItems: any[], confidence: number) => {
      this.logger.log(`[OCR-DEBUG] [API-RESPONSE] "${name}" — ${lineItems.length} items, confidence=${confidence}:`);
      for (let i = 0; i < lineItems.length; i++) {
        const it = lineItems[i];
        this.logger.log(
          `[OCR-DEBUG] [API-RESPONSE] "${name}" | Line ${i + 1}: desc="${(it.description || '').slice(0, 50)}" qty=${it.quantity} unitPrice=${it.unitPrice} totalPrice=${it.totalPrice}`,
        );
      }
    };

    if (detected.documentType === 'delivery_note' || detected.documentType === 'credit_note') {
      const parsed = await this.ocr.parseDeliveryNote(savedPath, companyId);
      const lineItems = mapLineItems(parsed.lineItems);
      logResponse(originalName, lineItems, parsed.confidence);
      return {
        fileUrl: savedPath,
        poNumber: null,
        supplierName: parsed.supplierName || null,
        supplierAddress: parsed.supplierAddress || null,
        vatNumber: parsed.supplierBusinessId || null,
        orderDate: parsed.deliveryDate || null,
        expectedDelivery: null,
        totalAmount: parsed.totalAmount,
        subtotal: parsed.subtotal,
        vatRate: parsed.vatRate,
        vatAmount: parsed.vatAmount,
        notes: parsed.notes || null,
        lineItems,
        confidence: parsed.confidence,
      };
    }

    if (detected.documentType === 'invoice') {
      const parsed = await this.ocr.parseInvoice(savedPath, companyId);
      const lineItems = mapLineItems(parsed.lineItems);
      logResponse(originalName, lineItems, parsed.confidence);
      return {
        fileUrl: savedPath,
        poNumber: null,
        supplierName: parsed.supplierName || null,
        supplierAddress: parsed.supplierAddress || null,
        vatNumber: parsed.supplierBusinessId || null,
        orderDate: parsed.invoiceDate || null,
        expectedDelivery: null,
        totalAmount: parsed.totalAmount,
        subtotal: parsed.subtotal,
        vatRate: parsed.vatRate,
        vatAmount: parsed.vatAmount,
        notes: parsed.notes || null,
        lineItems,
        confidence: parsed.confidence,
      };
    }

    // PO or quote — use PO parser (supplier/customer roles are correct)
    const parsed = await this.ocr.parsePurchaseOrder(savedPath, companyId);
    const lineItems = mapLineItems(parsed.lineItems);
    logResponse(originalName, lineItems, parsed.confidence);
    return {
      fileUrl: savedPath,
      poNumber: parsed.poNumber || null,
      supplierName: parsed.supplierName || null,
      supplierAddress: parsed.supplierAddress || null,
      vatNumber: parsed.supplierBusinessId || null,
      orderDate: parsed.orderDate || null,
      expectedDelivery: parsed.expectedDelivery || null,
      totalAmount: parsed.totalAmount,
      subtotal: parsed.subtotal,
      vatRate: parsed.vatRate,
      vatAmount: parsed.vatAmount,
      notes: parsed.notes || null,
      lineItems,
      confidence: parsed.confidence,
    };
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, ALLOWED_MIMES.includes(file.mimetype));
      },
    }),
  )
  async create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePODto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let fileUrl: string | undefined;

    // If a file was uploaded with the create request (and not already extracted via extract-quote)
    if (file) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      fileUrl = await this.storage.upload(file.buffer, originalName, companyId);
    } else if (dto.originalFileUrl && dto.originalFileUrl.startsWith(`companies/${companyId}/`)) {
      fileUrl = dto.originalFileUrl;
    }

    if (!fileUrl) {
      const companyName = await this.service.getCompanyName(companyId);
      const pdfBuffer = await this.pdfGenerator.generate({
        poNumber: dto.poNumber,
        supplierName: dto.supplierName,
        orderDate: dto.orderDate,
        expectedDelivery: dto.expectedDelivery,
        paymentTerms: dto.paymentTerms,
        vendorAddress: dto.vendorAddress,
        vatNumber: dto.vatNumber,
        siteContact: dto.siteContact,
        sitePhone: dto.sitePhone,
        deliveryNotes: dto.deliveryNotes,
        totalAmount: dto.totalAmount,
        currency: dto.currency,
        lineItems: dto.lineItems,
        companyName,
      });
      const safeName = dto.poNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      fileUrl = await this.storage.upload(pdfBuffer, `${safeName}.pdf`, companyId);
    }

    const po = await this.service.create({
      ...dto,
      companyId,
      createdById: userId,
      originalFileUrl: fileUrl,
    });

    // Always trigger full auto-matching after PO creation
    this.matching.autoMatch(companyId).then((result) => {
      if (po.projectId) {
        this.gateway.emitMatchingComplete(companyId, po.projectId, result.matchesCreated);
        this.gateway.emitDataChanged(companyId, 'project', { id: po.projectId });
      }
    }).catch((err) => {
      this.logger.warn(`autoMatch after PO create failed: ${err}`);
    });

    return po;
  }

  @Get('check-duplicate/:poNumber')
  async checkDuplicate(
    @Param('poNumber') poNumber: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    const existing = await this.service.findDuplicate(poNumber, companyId);
    return { exists: !!existing, poNumber };
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.findOne(id, companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpdatePODto,
  ) {
    return this.service.update(id, dto, companyId);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.delete(id, companyId);
  }
}
