import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ProjectsService } from './projects.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { isSameSupplier } from '../matching/supplier-matcher';

@Injectable()
export class ProjectBackfillService {
  private readonly logger = new Logger(ProjectBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly suppliersService: SuppliersService,
  ) {}

  async backfillProjects(companyId: string) {
    let totalAssigned = 0;
    // Session cache: cleaned name → project, avoids repeated findOrCreate DB queries
    const projectCache = new Map<string, { id: string; name: string }>();

    // Step 1: Assign projects to POs from their deliveryAddress (match existing only)
    totalAssigned += await this.assignProjectsToPOs(companyId, projectCache);

    // Step 2: Assign projects to DNs from their own parsedData (DNs only MATCH existing projects)
    totalAssigned += await this.assignProjectsToDNs(companyId, projectCache);

    // Step 3: Assign projects to invoices via their document references (poReference, deliveryNoteReferences)
    totalAssigned += await this.assignProjectsToInvoicesViaRefs(companyId);

    // Step 4: Propagate through shared emails - docs from the same email get the same project
    totalAssigned += await this.propagateProjectsThroughScanLogs(companyId);

    // Step 5: Propagate through matches - if a PO or DN has a project, assign it to sibling docs
    totalAssigned += await this.propagateProjectsThroughMatches(companyId);

    // Step 6: Supplier-based orphan matching - match remaining orphans by finding other docs from the same supplier
    totalAssigned += await this.assignOrphansBySupplier(companyId);

    // Step 7: Remove projects left with zero documents — e.g. auto-created from
    // one document's address that was later reassigned elsewhere. These empty
    // shells are pure noise on the projects screen.
    const pruned = await this.pruneEmptyProjects(companyId);

    this.logger.log(`Backfill complete for ${companyId}: ${totalAssigned} documents assigned to projects, ${pruned} empty projects pruned (cache hits: ${projectCache.size} entries)`);
    return { total: totalAssigned, assigned: totalAssigned };
  }

  /** Delete non-archived projects that ended up with no documents at all. */
  private async pruneEmptyProjects(companyId: string): Promise<number> {
    const empties = await this.prisma.project.findMany({
      where: {
        companyId,
        isArchived: false,
        deliveryNotes: { none: {} },
        purchaseOrders: { none: {} },
        invoices: { none: {} },
      },
      select: { id: true, name: true },
    });
    for (const p of empties) {
      // ProjectAddress rows cascade-delete with the project.
      await this.prisma.project
        .delete({ where: { id: p.id } })
        .catch((e) => this.logger.warn(`pruneEmptyProjects: failed to delete "${p.name}": ${e}`));
    }
    if (empties.length) {
      this.logger.log(`Pruned ${empties.length} empty projects: [${empties.map((p) => p.name).join(', ')}]`);
    }
    return empties.length;
  }

  /**
   * After auto-match creates/updates matches, propagate project assignments
   * across all documents in each match group.
   */
  async propagateProjectsForMatches(companyId: string, matchIds: string[]): Promise<void> {
    if (!matchIds.length) return;

    const matches = await this.prisma.threeWayMatch.findMany({
      where: { id: { in: matchIds } },
      include: {
        purchaseOrder: { select: { id: true, projectId: true } },
        deliveryNotes: { select: { id: true, projectId: true } },
        invoices: { select: { id: true, projectId: true } },
      },
    });

    for (const match of matches) {
      const projectIds = new Set<string>();
      if (match.purchaseOrder?.projectId) projectIds.add(match.purchaseOrder.projectId);
      for (const dn of match.deliveryNotes) if (dn.projectId) projectIds.add(dn.projectId);
      for (const inv of match.invoices) if (inv.projectId) projectIds.add(inv.projectId);
      if (projectIds.size === 0) continue;

      // Only FILL blanks — never OVERWRITE a document's existing address-derived
      // project. A match can span several sites (e.g. a bulk email matched together);
      // overwriting would collapse correctly-classified documents into one project.
      const canonicalProjectId = match.purchaseOrder?.projectId || [...projectIds][0];

      if (match.purchaseOrder && !match.purchaseOrder.projectId) {
        await this.prisma.purchaseOrder.update({ where: { id: match.purchaseOrder.id }, data: { projectId: canonicalProjectId } });
      }
      for (const dn of match.deliveryNotes) {
        if (!dn.projectId) {
          await this.prisma.deliveryNote.update({ where: { id: dn.id }, data: { projectId: canonicalProjectId } });
        }
      }
      for (const inv of match.invoices) {
        if (!inv.projectId) {
          await this.prisma.invoice.update({ where: { id: inv.id }, data: { projectId: canonicalProjectId } });
        }
      }

      if (projectIds.size > 1) {
        this.logger.warn(`Match ${match.id} spans ${projectIds.size} projects: [${[...projectIds].join(', ')}] → unified to ${canonicalProjectId}`);
      }
    }
  }

  // --- Cached wrappers ---

  private async cachedLookup(
    name: string, companyId: string,
    cache: Map<string, { id: string; name: string }>,
    finder: (n: string, cId: string) => Promise<{ id: string; name: string } | null>,
  ) {
    const cacheKey = this.projects.normalizeName(name);
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;
    for (const [cachedKey, cachedProject] of cache) {
      if (this.projects.isFuzzyMatch(cacheKey, cachedKey)) {
        cache.set(cacheKey, cachedProject);
        return cachedProject;
      }
    }
    const project = await finder(name, companyId);
    if (project) cache.set(cacheKey, { id: project.id, name: project.name });
    return project;
  }

  private cachedFindOnly(name: string, companyId: string, cache: Map<string, { id: string; name: string }>) {
    return this.cachedLookup(name, companyId, cache, (n, c) => this.projects.findExisting(n, c));
  }

  private cachedFindOrCreate(name: string, companyId: string, cache: Map<string, { id: string; name: string }>) {
    return this.cachedLookup(name, companyId, cache, (n, c) => this.projects.findOrCreate(n, c));
  }

  // --- Assignment steps ---

  /** Step 1: Assign projects to POs from their parsedData (POs only match existing projects, never create new ones) */
  private async assignProjectsToPOs(companyId: string, cache: Map<string, { id: string; name: string }>): Promise<number> {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { companyId, projectId: null },
      select: { id: true, parsedData: true, supplierName: true },
    });

    let assigned = 0;
    for (const po of pos) {
      // First: if the supplier already has documents in exactly ONE active
      // project, inherit it. A supplier serving several sites is ambiguous, so
      // we skip the shortcut and fall through to address-based matching instead
      // of collapsing the PO into an arbitrary project.
      if (po.supplierName) {
        const siblingPOs = await this.prisma.purchaseOrder.findMany({
          where: {
            companyId,
            supplierName: { contains: po.supplierName, mode: 'insensitive' },
            projectId: { not: null },
            project: { isArchived: false },
          },
          select: { projectId: true },
          take: 10,
        });
        const siblingProjectIds = new Set(
          siblingPOs.map((s) => s.projectId).filter((id): id is string => !!id),
        );
        if (siblingProjectIds.size === 1) {
          await this.prisma.purchaseOrder.update({ where: { id: po.id }, data: { projectId: [...siblingProjectIds][0] } });
          assigned++;
          continue;
        }
      }

      // Fallback: use delivery address to find/create project
      const parsed = po.parsedData as any;
      const name = parsed?.projectName || parsed?.deliveryAddress;
      if (!name) continue;

      const cleaned = this.projects.cleanAddress(name);
      if (!cleaned) continue;

      const project = await this.cachedFindOnly(cleaned, companyId, cache);
      if (project) {
        await this.prisma.purchaseOrder.update({ where: { id: po.id }, data: { projectId: project.id } });
        assigned++;
      }
    }
    this.logger.log(`Step 1: Assigned ${assigned} POs to projects from deliveryAddress`);
    return assigned;
  }

  /** Step 2: Assign projects to delivery notes from parsedData (find existing first, create if needed) */
  private async assignProjectsToDNs(companyId: string, cache: Map<string, { id: string; name: string }>): Promise<number> {
    const notes = await this.prisma.deliveryNote.findMany({
      where: { companyId, projectId: null },
      select: { id: true, parsedData: true },
    });

    let assigned = 0;
    for (const note of notes) {
      const parsed = note.parsedData as any;
      const name = parsed?.projectName || parsed?.deliveryAddress;
      if (!name) continue;

      const cleaned = this.projects.cleanAddress(name);
      if (!cleaned) continue;

      // DNs only match existing projects, never create new ones
      const project = await this.cachedFindOnly(cleaned, companyId, cache);
      if (project) {
        await this.prisma.deliveryNote.update({ where: { id: note.id }, data: { projectId: project.id } });
        assigned++;
      }
    }
    this.logger.log(`Step 2: Assigned ${assigned} DNs to projects from parsedData`);
    return assigned;
  }

  /** Step 3: Assign projects to invoices by matching their poReference or deliveryNoteReferences */
  private async assignProjectsToInvoicesViaRefs(companyId: string): Promise<number> {
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId, projectId: null },
      select: { id: true, parsedData: true },
    });

    let assigned = 0;
    for (const inv of invoices) {
      const parsed = inv.parsedData as any;
      let projectId: string | null = null;

      // Try matching via poReference → PO with projectId
      // poReference may contain extra text (e.g. "PO1492\nCR 2652"), so extract numeric-like refs and use contains
      const rawPoRef = parsed?.poReference;
      if (rawPoRef && !projectId) {
        const poRefs = String(rawPoRef).split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean);
        for (const ref of poRefs) {
          // Extract digits (e.g. "PO1492" → look for POs containing "1492")
          const digits = ref.replace(/\D/g, '');
          if (!digits || digits.length < 3) continue;
          const po = await this.prisma.purchaseOrder.findFirst({
            where: {
              companyId,
              poNumber: { contains: digits },
              projectId: { not: null },
              project: { isArchived: false },
            },
            select: { projectId: true },
          });
          if (po?.projectId) { projectId = po.projectId; break; }
        }
      }

      // Try matching via deliveryNoteReferences → DN with projectId
      const dnRefs: string[] = parsed?.deliveryNoteReferences || [];
      if (dnRefs.length > 0 && !projectId) {
        const dn = await this.prisma.deliveryNote.findFirst({
          where: {
            companyId,
            noteNumber: { in: dnRefs },
            projectId: { not: null },
            project: { isArchived: false },
          },
          select: { projectId: true },
        });
        if (dn?.projectId) projectId = dn.projectId;
      }

      if (projectId) {
        await this.prisma.invoice.update({ where: { id: inv.id }, data: { projectId } });
        assigned++;
      }
    }
    this.logger.log(`Step 3: Assigned ${assigned} invoices to projects via document references`);
    return assigned;
  }

  /** Step 4: Propagate projects through shared scan logs (same email = same project) */
  private async propagateProjectsThroughScanLogs(companyId: string): Promise<number> {
    const [dnsWithScanLog, allPOs, allInvoices] = await Promise.all([
      this.prisma.deliveryNote.findMany({
        where: { companyId, emailScanLogId: { not: null } },
        select: { id: true, emailScanLogId: true, projectId: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { companyId },
        select: { id: true, parsedData: true, projectId: true },
      }),
      this.prisma.invoice.findMany({
        where: { companyId },
        select: { id: true, parsedData: true, projectId: true },
      }),
    ]);

    const groups = this.groupDocsByScanLog(dnsWithScanLog, allPOs, allInvoices);

    let propagated = 0;
    for (const [, group] of groups) {
      if (group.pos.length + group.dns.length + group.invs.length < 2) continue;
      const projectId = group.pos.find((d) => d.projectId)?.projectId
        || group.dns.find((d) => d.projectId)?.projectId
        || group.invs.find((d) => d.projectId)?.projectId;
      if (!projectId) continue;

      const proj = await this.prisma.project.findUnique({ where: { id: projectId }, select: { isArchived: true } });
      if (proj?.isArchived) continue;

      propagated += await this.assignProjectToGroup(projectId, group);
    }
    this.logger.log(`Step 4: Propagated project to ${propagated} documents through shared scan logs`);
    return propagated;
  }

  private groupDocsByScanLog(dns: any[], pos: any[], invs: any[]): Map<string, { pos: any[]; dns: any[]; invs: any[] }> {
    const groups = new Map<string, { pos: any[]; dns: any[]; invs: any[] }>();
    const ensure = (id: string) => { if (!groups.has(id)) groups.set(id, { pos: [], dns: [], invs: [] }); return groups.get(id)!; };

    for (const dn of dns) { if (dn.emailScanLogId) ensure(dn.emailScanLogId).dns.push(dn); }
    for (const po of pos) { const id = (po.parsedData as any)?._scanLogId; if (id) ensure(id).pos.push(po); }
    for (const inv of invs) { const id = (inv.parsedData as any)?._scanLogId; if (id) ensure(id).invs.push(inv); }
    return groups;
  }

  private async assignProjectToGroup(projectId: string, group: { pos: any[]; dns: any[]; invs: any[] }): Promise<number> {
    let count = 0;
    for (const po of group.pos.filter((d) => !d.projectId)) {
      await this.prisma.purchaseOrder.update({ where: { id: po.id }, data: { projectId } }); count++;
    }
    for (const dn of group.dns.filter((d) => !d.projectId)) {
      await this.prisma.deliveryNote.update({ where: { id: dn.id }, data: { projectId } }); count++;
    }
    for (const inv of group.invs.filter((d) => !d.projectId)) {
      await this.prisma.invoice.update({ where: { id: inv.id }, data: { projectId } }); count++;
    }
    return count;
  }

  /** Step 5: Propagate projects through ThreeWayMatches */
  private async propagateProjectsThroughMatches(companyId: string): Promise<number> {
    const matches = await this.prisma.threeWayMatch.findMany({
      where: { companyId },
      include: {
        deliveryNotes: { select: { id: true, projectId: true } },
        purchaseOrder: { select: { id: true, projectId: true } },
        invoices: { select: { id: true, projectId: true } },
      },
    });

    const archivedCache = new Map<string, boolean>();
    const isArchived = async (id: string) => {
      if (!archivedCache.has(id)) {
        const p = await this.prisma.project.findUnique({ where: { id }, select: { isArchived: true } });
        archivedCache.set(id, p?.isArchived ?? false);
      }
      return archivedCache.get(id)!;
    };

    let propagated = 0;
    for (const match of matches) {
      const projectId = match.purchaseOrder?.projectId
        || match.deliveryNotes.find((dn) => dn.projectId)?.projectId
        || match.invoices.find((inv) => inv.projectId)?.projectId;
      if (!projectId || await isArchived(projectId)) continue;

      if (match.purchaseOrder && !match.purchaseOrder.projectId) {
        await this.prisma.purchaseOrder.update({ where: { id: match.purchaseOrder.id }, data: { projectId } });
        propagated++;
      }
      for (const dn of match.deliveryNotes.filter((d) => !d.projectId)) {
        await this.prisma.deliveryNote.update({ where: { id: dn.id }, data: { projectId } });
        propagated++;
      }
      for (const inv of match.invoices.filter((i) => !i.projectId)) {
        await this.prisma.invoice.update({ where: { id: inv.id }, data: { projectId } });
        propagated++;
      }
    }
    this.logger.log(`Step 5: Propagated project to ${propagated} documents through matches`);
    return propagated;
  }

  /** Step 6: Match remaining orphan documents by supplier name */
  private async assignOrphansBySupplier(companyId: string): Promise<number> {
    const { supplierProjectMap, nameProjectMap } = await this.buildSupplierProjectMaps(companyId);

    const findProjectForSupplier = async (supplierName: string, supplierId: string | null): Promise<string | null> => {
      if (supplierId && supplierProjectMap.has(supplierId)) return supplierProjectMap.get(supplierId)!;
      if (nameProjectMap.has(supplierName.toLowerCase())) return nameProjectMap.get(supplierName.toLowerCase())!;
      for (const [name, projectId] of nameProjectMap) {
        if (isSameSupplier(supplierName, name)) return projectId;
      }
      try {
        const resolved = await this.suppliersService.findOrCreate(supplierName, companyId);
        if (resolved && supplierProjectMap.has(resolved.id)) return supplierProjectMap.get(resolved.id)!;
      } catch { /* ignore */ }
      return null;
    };

    let assigned = 0;
    assigned += await this.assignOrphansOfType('invoice', companyId, findProjectForSupplier);
    assigned += await this.assignOrphansOfType('deliveryNote', companyId, findProjectForSupplier);
    assigned += await this.assignOrphansOfType('purchaseOrder', companyId, findProjectForSupplier);

    this.logger.log(`Step 6: Assigned ${assigned} orphan documents to projects by supplier matching`);
    return assigned;
  }

  private async buildSupplierProjectMaps(companyId: string) {
    // Collect the SET of active projects each supplier touches, then keep only
    // suppliers that map to exactly one — a supplier serving multiple sites is
    // ambiguous and must not pull orphans into an arbitrary project.
    const supplierProjects = new Map<string, Set<string>>();
    const nameProjects = new Map<string, Set<string>>();
    const addTo = (map: Map<string, Set<string>>, key: string, projectId: string) => {
      const set = map.get(key) ?? new Set<string>();
      set.add(projectId);
      map.set(key, set);
    };

    const docsWithProject = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where: { companyId, projectId: { not: null }, project: { isArchived: false } },
        select: { supplierId: true, supplierName: true, projectId: true },
      }),
      this.prisma.deliveryNote.findMany({
        where: { companyId, projectId: { not: null }, project: { isArchived: false } },
        select: { supplierId: true, supplierName: true, projectId: true },
      }),
      this.prisma.invoice.findMany({
        where: { companyId, projectId: { not: null }, project: { isArchived: false } },
        select: { supplierId: true, supplierName: true, projectId: true },
      }),
    ]);

    for (const docs of docsWithProject) {
      for (const doc of docs) {
        if (doc.supplierId && doc.projectId) addTo(supplierProjects, doc.supplierId, doc.projectId);
        if (doc.supplierName && doc.projectId) addTo(nameProjects, doc.supplierName.toLowerCase(), doc.projectId);
      }
    }

    const supplierProjectMap = new Map<string, string>();
    const nameProjectMap = new Map<string, string>();
    for (const [key, set] of supplierProjects) if (set.size === 1) supplierProjectMap.set(key, [...set][0]);
    for (const [key, set] of nameProjects) if (set.size === 1) nameProjectMap.set(key, [...set][0]);
    return { supplierProjectMap, nameProjectMap };
  }

  private async assignOrphansOfType(
    docType: 'invoice' | 'deliveryNote' | 'purchaseOrder',
    companyId: string,
    findProject: (supplierName: string, supplierId: string | null) => Promise<string | null>,
  ): Promise<number> {
    const model = this.prisma[docType] as any;
    const orphans = await model.findMany({
      where: { companyId, projectId: null },
      select: { id: true, supplierName: true, supplierId: true },
    });
    let assigned = 0;
    for (const doc of orphans) {
      if (!doc.supplierName) continue;
      const projectId = await findProject(doc.supplierName, doc.supplierId);
      if (projectId) {
        await model.update({ where: { id: doc.id }, data: { projectId } });
        assigned++;
      }
    }
    return assigned;
  }

  /**
   * Detect projects that might be duplicates based on shared suppliers and PO references.
   * Returns candidate pairs for user review (does not auto-merge).
   */
  async detectDuplicateProjects(companyId: string): Promise<Array<{
    projectA: { id: string; name: string };
    projectB: { id: string; name: string };
    reason: string;
  }>> {
    const projects = await this.prisma.project.findMany({
      where: { companyId, isArchived: false },
      include: {
        purchaseOrders: { select: { supplierId: true, poNumber: true } },
        deliveryNotes: { select: { supplierId: true } },
        invoices: { select: { supplierId: true } },
      },
    });

    const duplicates: Array<{
      projectA: { id: string; name: string };
      projectB: { id: string; name: string };
      reason: string;
    }> = [];

    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const reason = this.findDuplicateReason(projects[i], projects[j]);
        if (reason) {
          duplicates.push({
            projectA: { id: projects[i].id, name: projects[i].name },
            projectB: { id: projects[j].id, name: projects[j].name },
            reason,
          });
        }
      }
    }

    return duplicates;
  }

  private findDuplicateReason(
    a: { id: string; name: string; purchaseOrders: { supplierId: string | null; poNumber: string | null }[]; deliveryNotes: { supplierId: string | null }[]; invoices: { supplierId: string | null }[] },
    b: { id: string; name: string; purchaseOrders: { supplierId: string | null; poNumber: string | null }[]; deliveryNotes: { supplierId: string | null }[]; invoices: { supplierId: string | null }[] },
  ): string | null {
    const aPoNums = new Set(a.purchaseOrders.map((po) => po.poNumber).filter(Boolean));
    const bPoNums = new Set(b.purchaseOrders.map((po) => po.poNumber).filter(Boolean));
    const sharedPOs = [...aPoNums].filter((n) => bPoNums.has(n));
    if (sharedPOs.length > 0) return `מספרי הזמנה משותפים: ${sharedPOs.join(', ')}`;

    const aSuppliers = new Set([
      ...a.purchaseOrders.map((po) => po.supplierId).filter(Boolean),
      ...a.deliveryNotes.map((dn) => dn.supplierId).filter(Boolean),
      ...a.invoices.map((inv) => inv.supplierId).filter(Boolean),
    ]);
    const bSuppliers = new Set([
      ...b.purchaseOrders.map((po) => po.supplierId).filter(Boolean),
      ...b.deliveryNotes.map((dn) => dn.supplierId).filter(Boolean),
      ...b.invoices.map((inv) => inv.supplierId).filter(Boolean),
    ]);
    const sharedSuppliers = [...aSuppliers].filter((s) => bSuppliers.has(s));
    if (sharedSuppliers.length > 0 && (a.purchaseOrders.length === 0 || b.purchaseOrders.length === 0)) {
      return `ספקים משותפים ואחד הפרויקטים ללא הזמנת רכש`;
    }
    return null;
  }
}
