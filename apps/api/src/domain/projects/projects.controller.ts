import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectBackfillService } from './project-backfill.service';
import { ProjectDashboardService } from './project-dashboard.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateProjectDto, UpdateProjectDto, MergeProjectDto, CreateFromDocumentDto } from './dto/create-project.dto';
import { LinkDocumentsDto } from './dto/link-documents.dto';
import { EditLineItemDto } from './dto/edit-line-item.dto';
import { ExceptionActionDto } from './dto/exception-action.dto';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(
    private readonly service: ProjectsService,
    private readonly backfill: ProjectBackfillService,
    private readonly dashboard: ProjectDashboardService,
  ) {}

  @Get()
  findAll(
    @CurrentUser('companyId') companyId: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.service.findAll(companyId, includeArchived === 'true');
  }

  @Post('backfill')
  backfillProjects(@CurrentUser('companyId') companyId: string) {
    return this.backfill.backfillProjects(companyId);
  }

  @Post('create-from-document')
  createFromDocument(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateFromDocumentDto,
  ) {
    return this.service.createFromDocument(companyId, dto.documentId, dto.documentType, dto.name);
  }

  @Get('orphan-documents')
  getOrphanDocuments(@CurrentUser('companyId') companyId: string) {
    return this.dashboard.getOrphanDocuments(companyId);
  }

  @Delete('orphan-documents/:documentId')
  deleteOrphanDocument(
    @Param('documentId') documentId: string,
    @CurrentUser('companyId') companyId: string,
    @Query('type') documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice',
  ) {
    return this.dashboard.deleteOrphanDocument(companyId, documentId, documentType);
  }

  @Delete('line-items/:lineItemId')
  deleteLineItem(
    @Param('lineItemId') lineItemId: string,
    @CurrentUser('companyId') companyId: string,
    @Query('type') documentType: 'dn' | 'invoice',
  ) {
    return this.dashboard.deleteLineItem(lineItemId, documentType, companyId);
  }

  @Patch('documents/:documentId')
  updateDocument(
    @Param('documentId') documentId: string,
    @CurrentUser('companyId') companyId: string,
    @Query('type') documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice',
    @Body() body: { supplierName?: string; docNumber?: string; date?: string; totalAmount?: number; lineItems?: { description: string; catalogNumber: string; unit: string; quantity: string; unitPrice: string; discountPercent: string }[] },
  ) {
    return this.dashboard.updateDocument(companyId, documentId, documentType, body);
  }

  @Delete('documents/:documentId')
  removeDocument(
    @Param('documentId') documentId: string,
    @CurrentUser('companyId') companyId: string,
    @Query('type') documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice',
  ) {
    return this.dashboard.removeDocument(companyId, documentId, documentType);
  }

  @Patch('line-items/:lineItemId')
  editLineItem(
    @Param('lineItemId') lineItemId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: EditLineItemDto,
  ) {
    return this.dashboard.editLineItem(lineItemId, dto, userId, companyId);
  }

  @Post('line-items/:lineItemId/exception')
  resolveException(
    @Param('lineItemId') lineItemId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: ExceptionActionDto,
  ) {
    return this.dashboard.resolveException(lineItemId, dto, userId, companyId);
  }

  @Get('line-items/:lineItemId/audit-trail')
  getAuditTrail(
    @Param('lineItemId') lineItemId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.dashboard.getLineItemAuditTrail(lineItemId, companyId);
  }

  @Get(':id/full')
  getFullDetails(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.dashboard.getFullDetails(id, companyId);
  }

  @Get(':id/stats')
  getStats(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.dashboard.getProjectStats(id, companyId);
  }

  @Get(':id/vendors')
  getVendors(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.dashboard.getProjectVendors(id, companyId);
  }

  @Get(':id/vendors/:vendorId/line-items')
  getVendorLineItems(
    @Param('id') id: string,
    @Param('vendorId') vendorId: string,
    @CurrentUser('companyId') companyId: string,
    @Query('poId') poId?: string,
    @Query('status') status?: string,
    @Query('groupBy') groupBy?: 'orders' | 'deliveryNotes' | 'invoices',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.dashboard.getVendorLineItems(id, vendorId, { poId, status, groupBy, dateFrom, dateTo }, companyId);
  }

  @Get(':id/vendors/:vendorId/purchase-orders')
  getVendorPurchaseOrders(
    @Param('id') id: string,
    @Param('vendorId') vendorId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.dashboard.getVendorPurchaseOrders(id, vendorId, companyId);
  }

  @Get(':id/quotes')
  getQuotes(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.dashboard.getProjectQuotes(id, companyId);
  }

  @Get(':id/check-reconciliation')
  checkReconciliation(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.dashboard.checkAndTriggerReconciliation(id, companyId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.service.create(companyId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpdateProjectDto,
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

  @Get(':id/merge-addresses')
  getMergeAddresses(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.getMergeAddresses(id, companyId);
  }

  @Post(':id/merge')
  merge(
    @Param('id') targetId: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: MergeProjectDto,
  ) {
    return this.service.mergeProjects(targetId, dto.sourceProjectId, dto.addressesToInclude, companyId);
  }

  @Get(':id/delivery-notes')
  getDeliveryNotes(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.dashboard.getDeliveryNotes(id, companyId);
  }

  @Post(':id/link-documents')
  linkDocuments(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: LinkDocumentsDto,
  ) {
    return this.dashboard.linkDocuments(id, dto, companyId);
  }
}
