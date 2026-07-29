import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupplierMatchService } from './supplier-match.service';
import { OrphanConsolidatorService } from './orphan-consolidator.service';
import { MatchPostprocessorService } from './match-postprocessor.service';
import { AutoMatchContext } from './matching.types';
import { extractPoReferences, extractDnReferences, normalizeRef } from './reference-extractor';
import { buildAliasIndex } from './supplier-match.service';

@Injectable()
export class AutoMatchService {
  private readonly logger = new Logger(AutoMatchService.name);
  /** Per-company serialization queue to prevent concurrent auto-match runs creating duplicate matches */
  private readonly autoMatchQueue = new Map<string, Promise<{ matchesCreated: number; matchIds: string[] }>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly supplierMatch: SupplierMatchService,
    private readonly orphanConsolidator: OrphanConsolidatorService,
    private readonly matchPostprocessor: MatchPostprocessorService,
  ) {}

  async run(companyId: string, options?: { referenceOnly?: boolean; projectId?: string; supplierId?: string }): Promise<{ matchesCreated: number; matchIds: string[] }> {
    // Serialize auto-match runs per company to prevent race conditions
    // where concurrent runs load the same unmatched documents and create duplicate matches
    const previous = this.autoMatchQueue.get(companyId) || Promise.resolve({ matchesCreated: 0, matchIds: [] });
    const current = previous
      .catch(() => ({ matchesCreated: 0, matchIds: [] as string[] }))
      .then(() => this._run(companyId, options));
    this.autoMatchQueue.set(companyId, current);
    try {
      return await current;
    } finally {
      if (this.autoMatchQueue.get(companyId) === current) {
        this.autoMatchQueue.delete(companyId);
      }
    }
  }

  private async _run(companyId: string, options?: { referenceOnly?: boolean; projectId?: string; supplierId?: string }): Promise<{ matchesCreated: number; matchIds: string[] }> {
    const amStart = Date.now();
    const timer = (label: string) => this.logger.log(`⏱️ [AUTO-MATCH TIMING] ${label}: ${Date.now() - amStart}ms`);

    const ctx = await this.initContext(companyId, options);
    timer('initContext');

    this.logger.log(`AutoMatch [${options?.referenceOnly ? 'reference-only' : 'full'}]: ${ctx.unmatchedPOs.length} POs, ${ctx.unmatchedDNs.length} DNs, ${ctx.unmatchedInvoices.length} Invoices`);

    await this.matchByReferences(ctx);
    timer('matchByReferences');

    if (!options?.referenceOnly) {
      // Pre-load shared suppliers once (they don't change during auto-match)
      const cachedSuppliers = await this.prisma.supplier.findMany({
        where: { companyId },
        select: { id: true, name: true, aliases: true },
      });
      ctx.cachedSuppliers = cachedSuppliers;
      ctx.cachedAliasIndex = buildAliasIndex(cachedSuppliers);

      await this.supplierMatch.matchBySupplier(ctx);
      timer('matchBySupplier');

      // Load matches AFTER matchBySupplier so consolidateOrphans sees newly created matches
      ctx.cachedMatches = await this.prisma.threeWayMatch.findMany({
        where: { companyId },
        include: { purchaseOrder: true, deliveryNotes: true, invoices: true },
      });

      await this.orphanConsolidator.consolidateOrphans(ctx);
      timer('consolidateOrphans');
      // Invalidate cache — consolidateOrphans creates/deletes matches
      ctx.cachedMatches = undefined;
      await this.orphanConsolidator.mergeSameSupplierMatches(ctx);
      timer('mergeSameSupplierMatches');
      await this.orphanConsolidator.mergeWithinProject(ctx);
      timer('mergeWithinProject');
    }

    await this.matchPostprocessor.recomputeModifiedMatches(ctx);
    timer('recomputeModifiedMatches');

    // Propagate project assignments across all affected matches (new + updated)
    const allAffectedMatchIds = [...new Set([...ctx.created, ...ctx.updatedMatchIds])];
    if (allAffectedMatchIds.length > 0) {
      await this.propagateProjectsForMatches(allAffectedMatchIds);
    }
    timer('TOTAL');

    return { matchesCreated: ctx.created.length, matchIds: allAffectedMatchIds };
  }

  private async initContext(companyId: string, options?: { projectId?: string; supplierId?: string }): Promise<AutoMatchContext> {
    const poWhere: any = { companyId, isQuote: false, matches: { none: {} } };
    const dnWhere: any = { companyId, matches: { none: {} } };
    const invWhere: any = { companyId, matches: { none: {} } };

    if (options?.projectId) {
      poWhere.projectId = options.projectId;
      dnWhere.projectId = options.projectId;
      invWhere.projectId = options.projectId;
    }
    if (options?.supplierId) {
      poWhere.supplierId = options.supplierId;
      dnWhere.supplierId = options.supplierId;
      invWhere.supplierId = options.supplierId;
    }

    const [company, unmatchedPOs, unmatchedDNs, unmatchedInvoices] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
      this.prisma.purchaseOrder.findMany({ where: poWhere, include: { lineItems: true } }),
      this.prisma.deliveryNote.findMany({ where: dnWhere, include: { lineItems: true } }),
      this.prisma.invoice.findMany({ where: invWhere, include: { lineItems: true } }),
    ]);

    return {
      companyId, companyName: company?.name || null,
      unmatchedPOs, unmatchedDNs, unmatchedInvoices,
      matchedPOSet: new Set(), matchedDNSet: new Set(), matchedInvSet: new Set(),
      created: [], updatedMatchIds: new Set(),
    };
  }

  /**
   * Propagate project assignments across all documents in each match group.
   * If documents in a match have different projects, unify them to the PO's project (or first found).
   */
  private async propagateProjectsForMatches(matchIds: string[]): Promise<void> {
    if (!matchIds.length) return;

    const matches = await this.prisma.threeWayMatch.findMany({
      where: { id: { in: matchIds } },
      include: {
        purchaseOrder: { select: { id: true, projectId: true } },
        deliveryNotes: { select: { id: true, projectId: true } },
        invoices: { select: { id: true, projectId: true } },
      },
    });

    const txOps: any[] = [];

    for (const match of matches) {
      const projectIds = new Set<string>();
      if (match.purchaseOrder?.projectId) projectIds.add(match.purchaseOrder.projectId);
      for (const dn of match.deliveryNotes) {
        if (dn.projectId) projectIds.add(dn.projectId);
      }
      for (const inv of match.invoices) {
        if (inv.projectId) projectIds.add(inv.projectId);
      }

      if (projectIds.size === 0) continue;

      // Only FILL documents that have no project yet — never OVERWRITE a document's
      // existing, address-derived project. A single email can be matched across many
      // sites (e.g. OrphanConsolidator links a PO to every DN in the email); unifying
      // such a match would wrongly collapse correctly-classified documents into one
      // project. The canonical (PO's project, else the first found) only fills blanks.
      const canonicalProjectId = match.purchaseOrder?.projectId || [...projectIds][0];

      if (match.purchaseOrder && !match.purchaseOrder.projectId) {
        txOps.push(
          this.prisma.purchaseOrder.update({
            where: { id: match.purchaseOrder.id },
            data: { projectId: canonicalProjectId },
          }),
        );
      }

      const dnIdsToUpdate = match.deliveryNotes
        .filter((dn: any) => !dn.projectId)
        .map((dn: any) => dn.id);
      if (dnIdsToUpdate.length > 0) {
        txOps.push(
          this.prisma.deliveryNote.updateMany({
            where: { id: { in: dnIdsToUpdate } },
            data: { projectId: canonicalProjectId },
          }),
        );
      }

      const invIdsToUpdate = match.invoices
        .filter((inv: any) => !inv.projectId)
        .map((inv: any) => inv.id);
      if (invIdsToUpdate.length > 0) {
        txOps.push(
          this.prisma.invoice.updateMany({
            where: { id: { in: invIdsToUpdate } },
            data: { projectId: canonicalProjectId },
          }),
        );
      }

      if (projectIds.size > 1) {
        this.logger.warn(
          `Match ${match.id} spans ${projectIds.size} projects: [${[...projectIds].join(', ')}] → unified to ${canonicalProjectId}`,
        );
      }
    }

    if (txOps.length > 0) {
      await this.prisma.$transaction(txOps);
    }
  }

  // --- Strategy 1: Per-PO reference resolution ---
  // A 3-way match is EXACTLY one purchase order plus the delivery notes and invoices that
  // explicitly reference it (by poReference, or invoice→deliveryNoteReference→DN→PO). We never
  // group by supplier or by shared email here. Grouping coarser than the PO reference was the
  // root cause of "mega-matches": one PO linked to every DN/invoice of an email, so reconciliation
  // summed ordered/received/charged across unrelated orders into nonsense totals.
  private async matchByReferences(ctx: AutoMatchContext) {
    const dnByNoteNumber = new Map<string, any>();
    for (const dn of ctx.unmatchedDNs) {
      const noteNum = (dn as any).noteNumber;
      if (noteNum) dnByNoteNumber.set(normalizeRef(noteNum), dn);
    }
    const dnById = new Map<string, any>(ctx.unmatchedDNs.map((dn) => [dn.id, dn]));
    const poByPoNumber = new Map<string, any>();
    for (const po of ctx.unmatchedPOs) {
      if (po.poNumber) poByPoNumber.set(normalizeRef(po.poNumber), po);
    }

    // Resolve each DN to the SINGLE PO it references (its own poReference first, then a PO
    // that points at the DN). One DN belongs to one order — we take the first resolvable PO.
    const dnPoId = new Map<string, string>();
    for (const dn of ctx.unmatchedDNs) {
      for (const poRef of extractPoReferences(dn)) {
        const po = poByPoNumber.get(normalizeRef(poRef));
        if (po) { dnPoId.set(dn.id, po.id); break; }
      }
    }
    for (const po of ctx.unmatchedPOs) {
      for (const dnRef of extractDnReferences(po)) {
        const dn = dnByNoteNumber.get(normalizeRef(dnRef));
        if (dn && !dnPoId.has(dn.id)) dnPoId.set(dn.id, po.id);
      }
    }

    // Resolve each invoice to the SINGLE PO it references (direct poReference first, otherwise
    // via a referenced DN that already resolved to a PO). Remember the DN link for PO-less clusters.
    const invPoId = new Map<string, string>();
    const invDnId = new Map<string, string>();
    for (const inv of ctx.unmatchedInvoices) {
      let resolved = false;
      for (const poRef of extractPoReferences(inv)) {
        const po = poByPoNumber.get(normalizeRef(poRef));
        if (po) { invPoId.set(inv.id, po.id); resolved = true; break; }
      }
      for (const dnRef of extractDnReferences(inv)) {
        const dn = dnByNoteNumber.get(normalizeRef(dnRef));
        if (dn) {
          if (!invDnId.has(inv.id)) invDnId.set(inv.id, dn.id);
          if (!resolved && dnPoId.has(dn.id)) { invPoId.set(inv.id, dnPoId.get(dn.id)!); resolved = true; }
          break;
        }
      }
    }

    // Group the resolved DNs/invoices under their PO and create one match per PO.
    const dnsByPo = new Map<string, any[]>();
    for (const dn of ctx.unmatchedDNs) {
      const poId = dnPoId.get(dn.id);
      if (!poId) continue;
      if (!dnsByPo.has(poId)) dnsByPo.set(poId, []);
      dnsByPo.get(poId)!.push(dn);
    }
    const invsByPo = new Map<string, any[]>();
    for (const inv of ctx.unmatchedInvoices) {
      const poId = invPoId.get(inv.id);
      if (!poId) continue;
      if (!invsByPo.has(poId)) invsByPo.set(poId, []);
      invsByPo.get(poId)!.push(inv);
    }

    for (const po of ctx.unmatchedPOs) {
      if (ctx.matchedPOSet.has(po.id)) continue;
      const dns = dnsByPo.get(po.id) ?? [];
      const invs = invsByPo.get(po.id) ?? [];
      // A bare PO with no referencing document is left for the orphan step to make a PARTIAL.
      if (dns.length === 0 && invs.length === 0) continue;

      // Unify supplier IDs when reference matching links docs from different suppliers.
      await this.unifyGroupSuppliers({ pos: [po], dns, invs });

      ctx.matchedPOSet.add(po.id);
      for (const dn of dns) ctx.matchedDNSet.add(dn.id);
      for (const inv of invs) ctx.matchedInvSet.add(inv.id);
      await this.supplierMatch.createMatch(ctx, po, dns, invs);
    }

    // PO-less reference clusters: an invoice that references a DN, where neither resolved to a PO.
    // Still strictly reference-driven (never supplier/email), so a standalone DN+invoice pair
    // becomes its own match without dragging in unrelated documents.
    const polessByDn = new Map<string, { dn: any; invs: any[] }>();
    for (const inv of ctx.unmatchedInvoices) {
      if (ctx.matchedInvSet.has(inv.id) || invPoId.has(inv.id)) continue;
      const dnId = invDnId.get(inv.id);
      if (!dnId) continue;
      const dn = dnById.get(dnId);
      if (!dn || ctx.matchedDNSet.has(dn.id)) continue;
      if (!polessByDn.has(dnId)) polessByDn.set(dnId, { dn, invs: [] });
      polessByDn.get(dnId)!.invs.push(inv);
    }
    for (const [, { dn, invs }] of polessByDn) {
      if (invs.length === 0) continue;
      ctx.matchedDNSet.add(dn.id);
      for (const inv of invs) ctx.matchedInvSet.add(inv.id);
      await this.supplierMatch.createMatch(ctx, null, [dn], invs);
    }
  }

  /**
   * Unify supplier IDs within a cross-supplier match group.
   * The PO's supplier is canonical. DNs/Invoices are updated to the PO's supplierId,
   * and their original supplier names are added as aliases on the canonical supplier.
   */
  private async unifyGroupSuppliers(
    group: { pos: any[]; dns: any[]; invs: any[] },
  ): Promise<void> {
    const po = group.pos[0];
    if (!po?.supplierId) return;

    const canonicalSupplierId = po.supplierId;
    const canonicalSupplierName = po.supplierName;

    // Collect docs with a different supplierId
    const dnIdsToUpdate: string[] = [];
    const invIdsToUpdate: string[] = [];
    const aliasNames = new Set<string>();

    for (const dn of group.dns) {
      if (dn.supplierId && dn.supplierId !== canonicalSupplierId) {
        dnIdsToUpdate.push(dn.id);
        if (dn.supplierName) aliasNames.add(dn.supplierName);
      }
    }
    for (const inv of group.invs) {
      if (inv.supplierId && inv.supplierId !== canonicalSupplierId) {
        invIdsToUpdate.push(inv.id);
        if (inv.supplierName) aliasNames.add(inv.supplierName);
      }
    }

    if (dnIdsToUpdate.length === 0 && invIdsToUpdate.length === 0) return;

    // Atomically update supplier aliases and reassign documents
    const canonicalSupplier = await this.prisma.supplier.findUnique({
      where: { id: canonicalSupplierId },
    });

    const txOps: any[] = [];

    if (canonicalSupplier) {
      const existingAliases = new Set<string>(canonicalSupplier.aliases || []);
      let added = false;
      for (const alias of aliasNames) {
        if (alias !== canonicalSupplierName && !existingAliases.has(alias)) {
          existingAliases.add(alias);
          added = true;
        }
      }
      existingAliases.delete(canonicalSupplierName);
      if (added) {
        txOps.push(
          this.prisma.supplier.update({
            where: { id: canonicalSupplierId },
            data: { aliases: [...existingAliases] },
          }),
        );
      }
    }

    if (dnIdsToUpdate.length > 0) {
      txOps.push(
        this.prisma.deliveryNote.updateMany({
          where: { id: { in: dnIdsToUpdate } },
          data: { supplierId: canonicalSupplierId },
        }),
      );
    }

    if (invIdsToUpdate.length > 0) {
      txOps.push(
        this.prisma.invoice.updateMany({
          where: { id: { in: invIdsToUpdate } },
          data: { supplierId: canonicalSupplierId },
        }),
      );
    }

    if (txOps.length > 0) {
      await this.prisma.$transaction(txOps);
    }

    // Update in-memory objects so subsequent matching steps see the unified supplierId
    for (const dn of group.dns) {
      if (dnIdsToUpdate.includes(dn.id)) {
        dn.supplierId = canonicalSupplierId;
      }
    }
    for (const inv of group.invs) {
      if (invIdsToUpdate.includes(inv.id)) {
        inv.supplierId = canonicalSupplierId;
      }
    }

    this.logger.log(
      `Cross-supplier unification: unified ${dnIdsToUpdate.length} DNs + ${invIdsToUpdate.length} invoices to supplier "${canonicalSupplierName}" (${canonicalSupplierId}), aliases: [${[...aliasNames].join(', ')}]`,
    );
  }
}
