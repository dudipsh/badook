import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AggregateItemArgs, ChatItemToolsService } from './chat-item-tools.service';

const MAX_ROWS = 50;

export interface ChatToolScope {
  projectId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ChatToolContext {
  companyId: string;
  userId: string;
  scope?: ChatToolScope;
}

@Injectable()
export class ChatToolsService {
  private readonly logger = new Logger(ChatToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly itemTools: ChatItemToolsService,
  ) {}

  /**
   * Single entry point — routes a function call from the LLM to its implementation.
   * Returns a plain JSON-serializable object. Never throws — errors are returned as { error: string }.
   */
  async execute(name: string, args: Record<string, any>, ctx: ChatToolContext): Promise<unknown> {
    try {
      const effectiveArgs = this.withScopeDefaults(name, args, ctx);
      switch (name) {
        case 'list_projects':
          return await this.listProjects(effectiveArgs, ctx);
        case 'get_project_summary':
          return await this.getProjectSummary(effectiveArgs as { projectId: string }, ctx);
        case 'list_suppliers':
          return await this.listSuppliers(effectiveArgs, ctx);
        case 'list_discrepancies':
          return await this.listDiscrepancies(effectiveArgs, ctx);
        case 'get_company_overview':
          return await this.getCompanyOverview(ctx);
        case 'find_supplied_items':
          return await this.itemTools.findSuppliedItems(
            effectiveArgs as AggregateItemArgs,
            ctx.companyId,
          );
        case 'aggregate_item_supply':
          return await this.itemTools.aggregateItemSupply(
            effectiveArgs as AggregateItemArgs,
            ctx.companyId,
          );
        case 'list_item_documents':
          return await this.itemTools.listItemDocuments(
            effectiveArgs as AggregateItemArgs,
            ctx.companyId,
          );
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err: any) {
      this.logger.error(`Tool ${name} failed: ${err?.message}`, err?.stack);
      return { error: err?.message ?? 'Tool execution failed' };
    }
  }

  /**
   * UI scope (project/supplier/date filters) becomes the default for filter-
   * aware tools. Explicit args from the model always win.
   */
  private withScopeDefaults(
    name: string,
    args: Record<string, any>,
    ctx: ChatToolContext,
  ): Record<string, any> {
    const scope = ctx.scope;
    if (!scope) return args;
    const SCOPED_TOOLS = new Set([
      'aggregate_item_supply',
      'list_item_documents',
      'find_supplied_items',
      'list_discrepancies',
    ]);
    if (!SCOPED_TOOLS.has(name)) return args;
    const defaults: Record<string, any> = {};
    if (scope.projectId) defaults.projectId = scope.projectId;
    if (scope.supplierId) defaults.supplierId = scope.supplierId;
    if (name === 'aggregate_item_supply' || name === 'list_item_documents') {
      if (scope.dateFrom) defaults.dateFrom = scope.dateFrom;
      if (scope.dateTo) defaults.dateTo = scope.dateTo;
    }
    return { ...defaults, ...args };
  }

  private async listProjects(
    args: { includeArchived?: boolean; search?: string },
    ctx: ChatToolContext,
  ) {
    const projects = await this.prisma.project.findMany({
      where: {
        companyId: ctx.companyId,
        ...(args.includeArchived ? {} : { isArchived: false }),
        ...(args.search ? { name: { contains: args.search, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        name: true,
        address: true,
        isArchived: true,
        _count: { select: { deliveryNotes: true, purchaseOrders: true, invoices: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: MAX_ROWS,
    });
    return {
      count: projects.length,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        isArchived: p.isArchived,
        deliveryNoteCount: p._count.deliveryNotes,
        purchaseOrderCount: p._count.purchaseOrders,
        invoiceCount: p._count.invoices,
      })),
    };
  }

  private async getProjectSummary(args: { projectId: string }, ctx: ChatToolContext) {
    const project = await this.prisma.project.findFirst({
      where: { id: args.projectId, companyId: ctx.companyId },
      include: {
        _count: { select: { deliveryNotes: true, purchaseOrders: true, invoices: true } },
      },
    });
    if (!project) return { error: 'Project not found' };

    const [invoiceAgg, poAgg, matches] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { companyId: ctx.companyId, projectId: project.id },
        _sum: { totalAmount: true },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { companyId: ctx.companyId, projectId: project.id },
        _sum: { totalAmount: true },
      }),
      this.prisma.threeWayMatch.groupBy({
        by: ['status'],
        where: {
          companyId: ctx.companyId,
          purchaseOrder: { is: { projectId: project.id } },
        },
        _count: true,
      }),
    ]);

    const matchByStatus = Object.fromEntries(matches.map((m) => [m.status, m._count]));
    const totalMatches = Object.values(matchByStatus).reduce((a, b) => a + (b as number), 0);
    const matchedCount = (matchByStatus['MATCHED'] as number) ?? 0;

    return {
      id: project.id,
      name: project.name,
      address: project.address,
      isArchived: project.isArchived,
      deliveryNoteCount: project._count.deliveryNotes,
      purchaseOrderCount: project._count.purchaseOrders,
      invoiceCount: project._count.invoices,
      totalInvoiceAmountIls: Number(invoiceAgg._sum.totalAmount ?? 0),
      totalPurchaseOrderAmountIls: Number(poAgg._sum.totalAmount ?? 0),
      matchSummary: matchByStatus,
      matchRate: totalMatches > 0 ? Math.round((matchedCount / totalMatches) * 100) : null,
    };
  }

  private async listSuppliers(
    args: { search?: string; projectId?: string },
    ctx: ChatToolContext,
  ) {
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        companyId: ctx.companyId,
        ...(args.search ? { name: { contains: args.search, mode: 'insensitive' } } : {}),
        ...(args.projectId
          ? { purchaseOrders: { some: { projectId: args.projectId } } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        businessId: true,
        phone: true,
        email: true,
        _count: { select: { deliveryNotes: true, purchaseOrders: true, invoices: true } },
      },
      orderBy: { name: 'asc' },
      take: MAX_ROWS,
    });
    return {
      count: suppliers.length,
      suppliers: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        businessId: s.businessId,
        phone: s.phone,
        email: s.email,
        deliveryNoteCount: s._count.deliveryNotes,
        purchaseOrderCount: s._count.purchaseOrders,
        invoiceCount: s._count.invoices,
      })),
    };
  }

  private async listDiscrepancies(
    args: { projectId?: string; supplierId?: string; limit?: number },
    ctx: ChatToolContext,
  ) {
    const limit = Math.min(args.limit ?? 20, MAX_ROWS);
    const matches = await this.prisma.threeWayMatch.findMany({
      where: {
        companyId: ctx.companyId,
        status: { in: ['PARTIAL', 'DISCREPANCY', 'UNMATCHED'] },
        ...(args.projectId
          ? { purchaseOrder: { is: { projectId: args.projectId } } }
          : {}),
        ...(args.supplierId
          ? { purchaseOrder: { is: { supplierId: args.supplierId } } }
          : {}),
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        purchaseOrder: {
          select: {
            poNumber: true,
            totalAmount: true,
            supplier: { select: { name: true } },
            project: { select: { name: true } },
          },
        },
        invoices: {
          select: { invoiceNumber: true, totalAmount: true, supplier: { select: { name: true } } },
        },
        deliveryNotes: {
          select: { noteNumber: true, supplier: { select: { name: true } } },
        },
      },
    });
    return {
      count: matches.length,
      discrepancies: matches.map((m) => ({
        id: m.id,
        status: m.status,
        projectName: m.purchaseOrder?.project?.name ?? null,
        supplierName:
          m.purchaseOrder?.supplier?.name ??
          m.invoices[0]?.supplier?.name ??
          m.deliveryNotes[0]?.supplier?.name ??
          null,
        poNumber: m.purchaseOrder?.poNumber ?? m.tempPoNumber ?? null,
        invoiceNumbers: m.invoices.map((i) => i.invoiceNumber),
        deliveryNoteNumbers: m.deliveryNotes.map((d) => d.noteNumber).filter(Boolean),
        totalInvoiceAmountIls: m.invoices.reduce(
          (sum, i) => sum + Number(i.totalAmount ?? 0),
          0,
        ),
        totalPoAmountIls: Number(m.purchaseOrder?.totalAmount ?? 0),
        discrepancyDetails: m.discrepancies,
        notes: m.notes,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  private async getCompanyOverview(ctx: ChatToolContext) {
    const [projects, suppliers, deliveryNotes, purchaseOrders, invoices, matchedCount, unmatchedCount] = await Promise.all([
      this.prisma.project.count({ where: { companyId: ctx.companyId, isArchived: false } }),
      this.prisma.supplier.count({ where: { companyId: ctx.companyId } }),
      this.prisma.deliveryNote.count({ where: { companyId: ctx.companyId } }),
      this.prisma.purchaseOrder.count({ where: { companyId: ctx.companyId } }),
      this.prisma.invoice.count({ where: { companyId: ctx.companyId } }),
      this.prisma.threeWayMatch.count({ where: { companyId: ctx.companyId, status: 'MATCHED' } }),
      this.prisma.threeWayMatch.count({
        where: { companyId: ctx.companyId, status: { in: ['PARTIAL', 'DISCREPANCY', 'UNMATCHED'] } },
      }),
    ]);
    return {
      projectCount: projects,
      supplierCount: suppliers,
      deliveryNoteCount: deliveryNotes,
      purchaseOrderCount: purchaseOrders,
      invoiceCount: invoices,
      matchedCount,
      unmatchedOrPartialCount: unmatchedCount,
    };
  }
}
