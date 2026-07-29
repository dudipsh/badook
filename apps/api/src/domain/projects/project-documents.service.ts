import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ProjectsService } from './projects.service';
import { MatchingService } from '../matching/matching.service';
import { JobsGateway } from '../../infrastructure/jobs/jobs.gateway';
import { StorageService } from '../../infrastructure/storage/storage.service';

@Injectable()
export class ProjectDocumentsService {
  private readonly logger = new Logger(ProjectDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly matchingService: MatchingService,
    private readonly gateway: JobsGateway,
    private readonly storage: StorageService,
  ) {}

  private async ensureExists(id: string, companyId?: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (companyId && project.companyId !== companyId) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async getDeliveryNotes(id: string, companyId?: string) {
    await this.ensureExists(id, companyId);
    return this.prisma.deliveryNote.findMany({
      where: { projectId: id },
      include: { lineItems: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFullDetails(id: string, companyId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { deliveryNotes: true, purchaseOrders: true, invoices: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (companyId && project.companyId !== companyId) {
      throw new NotFoundException('Project not found');
    }

    const deliveryNotes = await this.prisma.deliveryNote.findMany({
      where: { projectId: id },
      include: { lineItems: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    });

    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: { projectId: id },
      include: { lineItems: true },
      orderBy: { createdAt: 'desc' },
    });

    const invoices = await this.prisma.invoice.findMany({
      where: { projectId: id },
      include: { lineItems: true },
      orderBy: { createdAt: 'desc' },
    });

    const poIds = purchaseOrders.map((po) => po.id);
    const matches = await this.prisma.threeWayMatch.findMany({
      where: {
        OR: [
          { deliveryNotes: { some: { projectId: id } } },
          ...(poIds.length > 0 ? [{ purchaseOrderId: { in: poIds } }] : []),
          { invoices: { some: { projectId: id } } },
        ],
      },
      include: {
        purchaseOrder: { include: { lineItems: true } },
        invoices: { include: { lineItems: true } },
        deliveryNotes: { include: { lineItems: true, supplier: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      deliveryNotesCount: deliveryNotes.length,
      deliveryNotesTotal: deliveryNotes.reduce((sum, dn) => sum + (dn.totalAmount?.toNumber() ?? 0), 0),
      purchaseOrdersCount: purchaseOrders.length,
      purchaseOrdersTotal: purchaseOrders.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0),
      invoicesCount: invoices.length,
      invoicesTotal: invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0),
      matchesCount: matches.length,
    };

    return { project, summary, deliveryNotes, purchaseOrders, invoices, matches };
  }

  async deleteOrphanDocument(
    companyId: string,
    documentId: string,
    documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice',
  ) {
    const modelMap = {
      deliveryNote: this.prisma.deliveryNote,
      purchaseOrder: this.prisma.purchaseOrder,
      invoice: this.prisma.invoice,
    } as const;
    const model = modelMap[documentType] as any;

    const doc = await model.findFirst({
      where: { id: documentId, companyId, projectId: null },
    });
    if (!doc) {
      throw new NotFoundException('Orphan document not found');
    }

    // Delete S3 files before removing DB record
    for (const key of [doc.originalFileUrl, doc.originalFileUrlHq]) {
      if (key) { try { await this.storage.delete(key); } catch { /* best-effort */ } }
    }
    // Cascade handles line items deletion
    await model.delete({ where: { id: documentId } });
    return { deleted: true };
  }

  async getOrphanDocuments(companyId: string) {
    const [deliveryNotes, purchaseOrders, invoices] = await Promise.all([
      this.prisma.deliveryNote.findMany({
        where: { companyId, projectId: null },
        select: {
          id: true,
          noteNumber: true,
          supplierName: true,
          deliveryDate: true,
          totalAmount: true,
          vatAmount: true,
          originalFileUrl: true,
          createdAt: true,
          status: true,
          parsingConfidence: true,
          supplierId: true,
          notes: true,
          parsedData: true,
          emailScanLog: {
            select: { senderEmail: true, senderName: true },
          },
          lineItems: {
            select: {
              description: true, catalogNumber: true, quantity: true,
              unit: true, unitPrice: true, totalPrice: true,
              discountPercent: true, sortOrder: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { companyId, projectId: null },
        select: {
          id: true,
          poNumber: true,
          supplierName: true,
          orderDate: true,
          totalAmount: true,
          originalFileUrl: true,
          createdAt: true,
          supplierId: true,
          status: true,
          notes: true,
          parsedData: true,
          lineItems: {
            select: {
              description: true, catalogNumber: true, quantity: true,
              unit: true, unitPrice: true, totalPrice: true,
              discountPercent: true, sortOrder: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.findMany({
        where: { companyId, projectId: null },
        select: {
          id: true,
          invoiceNumber: true,
          supplierName: true,
          invoiceDate: true,
          totalAmount: true,
          vatAmount: true,
          originalFileUrl: true,
          createdAt: true,
          supplierId: true,
          status: true,
          parsedData: true,
          lineItems: {
            select: {
              description: true, catalogNumber: true, quantity: true,
              unit: true, unitPrice: true, totalPrice: true,
              discountPercent: true, sortOrder: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { deliveryNotes, purchaseOrders, invoices };
  }

  async linkDocuments(
    projectId: string,
    dto: { documents: Array<{ type: string; id: string }> },
    companyId?: string,
  ) {
    const project = await this.ensureExists(projectId, companyId);
    if (project.isArchived) {
      throw new BadRequestException(
        'Cannot link documents to an archived project',
      );
    }

    const dns = dto.documents.filter((d) => d.type === 'deliveryNote').map((d) => d.id);
    const pos = dto.documents.filter((d) => d.type === 'purchaseOrder').map((d) => d.id);
    const invs = dto.documents.filter((d) => d.type === 'invoice').map((d) => d.id);

    const results = await Promise.all([
      dns.length > 0
        ? this.prisma.deliveryNote.updateMany({ where: { id: { in: dns }, companyId: project.companyId }, data: { projectId } })
        : { count: 0 },
      pos.length > 0
        ? this.prisma.purchaseOrder.updateMany({ where: { id: { in: pos }, companyId: project.companyId }, data: { projectId } })
        : { count: 0 },
      invs.length > 0
        ? this.prisma.invoice.updateMany({ where: { id: { in: invs }, companyId: project.companyId }, data: { projectId } })
        : { count: 0 },
    ]);

    // Extract addresses from linked documents and add as secondary addresses
    await this.addAddressesFromDocuments(projectId, { dns, pos });

    // Re-run matching so quantities and pairings update after linking
    this.gateway.emitMatchingStarted(project.companyId, projectId);
    this.matchingService.autoMatch(project.companyId, { projectId }).then((result) => {
      this.gateway.emitMatchingComplete(project.companyId, projectId, result.matchesCreated);
      this.gateway.emitDataChanged(project.companyId, 'project', { id: projectId });
    }).catch((e) => {
      this.logger.warn(`autoMatch after linkDocuments failed: ${e}`);
      this.gateway.emitMatchingComplete(project.companyId, projectId);
    });

    return { linked: results.reduce((sum, r) => sum + r.count, 0) };
  }

  private async addAddressesFromDocuments(projectId: string, docIds: { dns: string[]; pos: string[] }) {
    const [posDocs, dnsDocs] = await Promise.all([
      docIds.pos.length > 0
        ? this.prisma.purchaseOrder.findMany({ where: { id: { in: docIds.pos } }, select: { parsedData: true } })
        : [],
      docIds.dns.length > 0
        ? this.prisma.deliveryNote.findMany({ where: { id: { in: docIds.dns } }, select: { parsedData: true } })
        : [],
    ]);
    for (const doc of [...posDocs, ...dnsDocs]) {
      const parsed = doc.parsedData as any;
      const addr = parsed?.deliveryAddress || parsed?.projectName;
      if (addr) {
        await this.projectsService.addSecondaryAddress(projectId, addr);
      }
    }
  }
}
