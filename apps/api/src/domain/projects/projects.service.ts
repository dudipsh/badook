import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JobsGateway } from '../../infrastructure/jobs/jobs.gateway';
import { MatchingService } from '../matching/matching.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import {
  cleanAddress as cleanAddressUtil,
  normalizeName as normalizeNameUtil,
  isFuzzyMatch as isFuzzyMatchUtil,
  isValidProjectName,
} from './project-name-utils';
import * as fs from 'fs';

const PROJECT_LOG = '/tmp/project-debug.log';
function plog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(PROJECT_LOG, line);
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  /** Per-company lock to prevent concurrent findOrCreate from creating duplicate projects */
  private readonly createLocks = new Map<string, Promise<any>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: JobsGateway,
    private readonly matchingService: MatchingService,
  ) {}

  async findAll(companyId: string, includeArchived = false) {
    const projects = await this.prisma.project.findMany({
      where: { companyId, ...(includeArchived ? {} : { isArchived: false }) },
      include: {
        _count: {
          select: {
            deliveryNotes: true,
            purchaseOrders: true,
            invoices: true,
          },
        },
        addresses: { select: { id: true, address: true } },
        purchaseOrders: {
          where: { isQuote: false },
          select: { totalAmount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map(({ purchaseOrders, ...rest }) => ({
      ...rest,
      totalSpend: purchaseOrders.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0),
      documentCount: (rest._count.purchaseOrders || 0) + (rest._count.deliveryNotes || 0) + (rest._count.invoices || 0),
    }));
  }

  async findOne(id: string, companyId?: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (companyId && project.companyId !== companyId) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async create(companyId: string, dto: CreateProjectDto) {
    plog(`create() API called with name="${dto.name}"`);
    plog(`create() stack: ${new Error().stack?.split('\n').slice(1, 4).join(' <- ')}`);
    this.logger.log(`[PROJECT-DEBUG] create() called with name="${dto.name}" — stack: ${new Error().stack?.split('\n').slice(1, 4).join(' <- ')}`);
    return this.prisma.project.create({
      data: { ...dto, companyId },
    });
  }

  async update(id: string, dto: UpdateProjectDto, companyId?: string) {
    await this.findOne(id, companyId);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async delete(id: string, companyId?: string) {
    await this.findOne(id, companyId);
    // Nullify projectId on related documents before deleting
    await Promise.all([
      this.prisma.deliveryNote.updateMany({ where: { projectId: id }, data: { projectId: null } }),
      this.prisma.purchaseOrder.updateMany({ where: { projectId: id }, data: { projectId: null } }),
      this.prisma.invoice.updateMany({ where: { projectId: id }, data: { projectId: null } }),
    ]);
    return this.prisma.project.delete({ where: { id } });
  }

  async findOrCreate(name: string, companyId: string, address?: string) {
    // Serialize per-company to prevent race conditions when parallel workers
    // both find no match and create duplicate projects
    const prev = this.createLocks.get(companyId) ?? Promise.resolve();
    let resolve!: () => void;
    const lock = new Promise<void>((r) => { resolve = r; });
    this.createLocks.set(companyId, lock);
    try {
      await prev;
      return await this._findOrCreate(name, companyId, address);
    } finally {
      resolve();
      if (this.createLocks.get(companyId) === lock) {
        this.createLocks.delete(companyId);
      }
    }
  }

  private async _findOrCreate(name: string, companyId: string, address?: string) {
    const trimmed = name.trim();
    if (!trimmed) return null;

    // Quality gate: reject garbage OCR names at every entry point
    if (!isValidProjectName(trimmed)) {
      this.logger.warn(`findOrCreate rejected garbage name: "${trimmed}"`);
      return null;
    }

    // Use a database-level advisory lock to prevent cross-process race conditions.
    // Multiple worker processes share the same DB but have separate in-memory locks,
    // so only a DB lock can prevent duplicate project creation.
    return this.prisma.$transaction(async (tx) => {
      // Advisory lock scoped to this transaction — released on commit/rollback
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId + ':project_create'}))`;
      plog(`_findOrCreate: acquired lock for "${trimmed}"`);
      this.logger.log(`[PROJECT-DEBUG] _findOrCreate: acquired lock for "${trimmed}"`);

      // 1. Exact name match (case-insensitive)
      let existing = await tx.project.findFirst({
        where: {
          name: { equals: trimmed, mode: 'insensitive' },
          companyId,
        },
      });
      if (existing) {
        plog(`_findOrCreate: EXACT match "${trimmed}" → "${existing.name}" (${existing.id})`);
        this.logger.log(`[PROJECT-DEBUG] _findOrCreate: EXACT match "${trimmed}" → "${existing.name}" (${existing.id})`);
      }

      // 2. Fuzzy name match
      if (!existing) {
        const allProjects = await tx.project.findMany({
          where: { companyId },
          select: { id: true, name: true, address: true, isArchived: true, companyId: true, createdAt: true, updatedAt: true },
        });
        plog(`_findOrCreate: "${trimmed}" — ${allProjects.length} existing projects: [${allProjects.map(p => `"${p.name}"`).join(', ')}]`);
        this.logger.log(`[PROJECT-DEBUG] _findOrCreate: "${trimmed}" — ${allProjects.length} existing projects to fuzzy-check: [${allProjects.map(p => `"${p.name}"`).join(', ')}]`);
        const newNorm = this.normalizeName(trimmed);
        for (const proj of allProjects) {
          const projNorm = this.normalizeName(proj.name);
          const matched = this.isFuzzyMatch(newNorm, projNorm);
          plog(`_findOrCreate: fuzzy("${newNorm}", "${projNorm}") = ${matched}`);
          this.logger.log(`[PROJECT-DEBUG] _findOrCreate: fuzzy("${newNorm}", "${projNorm}") = ${matched}`);
          if (matched) {
            existing = proj;
            this.logger.log(`Fuzzy matched project "${trimmed}" to "${proj.name}"`);
            break;
          }
        }
      }

      // 3. Check secondary addresses (exact + fuzzy) — same as findExisting
      if (!existing) {
        const allAddresses = await tx.projectAddress.findMany({
          where: { project: { companyId, isArchived: false } },
          include: { project: true },
        });
        const newNorm = this.normalizeName(trimmed);
        for (const addr of allAddresses) {
          const addrNorm = this.normalizeName(addr.address);
          if (addrNorm === newNorm || this.isFuzzyMatch(newNorm, addrNorm)) {
            existing = addr.project;
            this.logger.log(`findOrCreate matched "${trimmed}" to secondary address "${addr.address}" of project "${addr.project.name}"`);
            break;
          }
        }
      }

      if (existing) {
        if (existing.isArchived) {
          this.logger.log(
            `findOrCreate: "${trimmed}" matches archived ` +
            `project "${existing.name}" — skipping`,
          );
          return null;
        }
        // Populate the display "site location" if the project was created without one
        const addr = address?.trim();
        if (addr && !existing.address) {
          await tx.project.update({ where: { id: existing.id }, data: { address: addr } });
          existing = { ...existing, address: addr };
        }
        return existing;
      }

      plog(`CREATING NEW project: "${trimmed}" for company ${companyId}`);
      plog(`Call stack: ${new Error().stack?.split('\n').slice(1, 6).join(' <- ')}`);
      this.logger.log(`[PROJECT-DEBUG] Creating NEW project: "${trimmed}" for company ${companyId} (no match found)`);
      this.logger.log(`[PROJECT-DEBUG] Call stack: ${new Error().stack?.split('\n').slice(1, 6).join(' <- ')}`);
      const created = await tx.project.create({
        data: { name: trimmed, companyId, address: address || null },
      });
      this.gateway.emitDataChanged(companyId, 'project', { id: created.id, name: created.name });
      return created;
    }, { timeout: 15000 });
  }

  /** Find existing project by name (exact + fuzzy) or secondary address, without creating a new one */
  async findExisting(name: string, companyId: string) {
    const trimmed = name.trim();
    if (!trimmed) return null;

    // 1. Exact name match (case-insensitive) on non-archived projects
    let existing = await this.prisma.project.findFirst({
      where: {
        name: { equals: trimmed, mode: 'insensitive' },
        companyId,
        isArchived: false,
      },
    });

    // 2. Fuzzy name match
    if (!existing) {
      const allProjects = await this.prisma.project.findMany({
        where: { companyId, isArchived: false },
        select: { id: true, name: true, address: true, isArchived: true, companyId: true, createdAt: true, updatedAt: true },
      });
      const newNorm = this.normalizeName(trimmed);
      for (const proj of allProjects) {
        const projNorm = this.normalizeName(proj.name);
        if (this.isFuzzyMatch(newNorm, projNorm)) {
          existing = proj;
          this.logger.log(`findExisting fuzzy matched "${trimmed}" to "${proj.name}"`);
          break;
        }
      }
    }

    // 3. Check secondary addresses (exact + fuzzy)
    if (!existing) {
      const allAddresses = await this.prisma.projectAddress.findMany({
        where: { project: { companyId, isArchived: false } },
        include: { project: true },
      });
      const newNorm = this.normalizeName(trimmed);
      for (const addr of allAddresses) {
        const addrNorm = this.normalizeName(addr.address);
        if (addrNorm === newNorm || this.isFuzzyMatch(newNorm, addrNorm)) {
          existing = addr.project;
          this.logger.log(`findExisting matched "${trimmed}" to secondary address "${addr.address}" of project "${addr.project.name}"`);
          break;
        }
      }
    }

    return existing;
  }

  /**
   * Upgrade project name if the new address is more specific (contains current name + extra info).
   * e.g. project "פתח תקווה" → upgrade to "יגיע כפיים פתח תקווה" when a document has the full address.
   */
  async upgradeNameIfBetter(projectId: string, newAddress: string): Promise<void> {
    const cleaned = this.cleanAddress(newAddress);
    if (!cleaned) return;

    const project = await this.findOne(projectId);
    const currentNorm = this.normalizeName(project.name);
    const newNorm = this.normalizeName(cleaned);

    // Only upgrade if new name contains old name AND is meaningfully longer (at least 3 chars more)
    if (newNorm.includes(currentNorm) && newNorm.length > currentNorm.length + 3) {
      this.logger.log(`Upgrading project name: "${project.name}" → "${cleaned}"`);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { name: cleaned },
      });
      // Add old name as secondary address so fuzzy matching still works
      await this.addSecondaryAddress(projectId, project.name);
    }
  }

  // --- Secondary addresses ---

  async addSecondaryAddress(projectId: string, rawAddress: string): Promise<void> {
    const cleaned = this.cleanAddress(rawAddress);
    if (!cleaned) return;
    const project = await this.findOne(projectId);
    if (this.isFuzzyMatch(this.normalizeName(cleaned), this.normalizeName(project.name))) return;
    await this.prisma.projectAddress.upsert({
      where: { projectId_address: { projectId, address: cleaned } },
      create: { projectId, address: cleaned },
      update: {},
    }).catch(() => {
      // Ignore duplicate constraint errors
    });
  }

  async removeOrphanedAddresses(projectId: string): Promise<void> {
    const addresses = await this.prisma.projectAddress.findMany({ where: { projectId } });
    for (const addr of addresses) {
      const norm = this.normalizeName(addr.address);
      const hasDoc = await this.hasDocumentWithAddress(projectId, norm);
      if (!hasDoc) {
        await this.prisma.projectAddress.delete({ where: { id: addr.id } });
        this.logger.log(`Removed orphaned secondary address "${addr.address}" from project ${projectId}`);
      }
    }
  }

  private async hasDocumentWithAddress(projectId: string, normalizedAddress: string): Promise<boolean> {
    const [pos, dns] = await Promise.all([
      this.prisma.purchaseOrder.findMany({ where: { projectId }, select: { parsedData: true } }),
      this.prisma.deliveryNote.findMany({ where: { projectId }, select: { parsedData: true } }),
    ]);
    for (const doc of [...pos, ...dns]) {
      const parsed = doc.parsedData as any;
      const docAddr = parsed?.deliveryAddress || parsed?.projectName;
      if (docAddr) {
        const cleaned = this.cleanAddress(docAddr);
        if (cleaned && this.isFuzzyMatch(this.normalizeName(cleaned), normalizedAddress)) return true;
      }
    }
    return false;
  }

  // --- Merge projects ---

  /** Get all addresses associated with a project (name + secondary addresses) for merge UI */
  async getMergeAddresses(sourceId: string, companyId?: string): Promise<string[]> {
    const source = await this.findOne(sourceId, companyId);
    const secondaryAddresses = await this.prisma.projectAddress.findMany({
      where: { projectId: sourceId },
      select: { address: true },
    });
    const addresses: string[] = [source.name];
    for (const addr of secondaryAddresses) {
      if (!addresses.includes(addr.address)) addresses.push(addr.address);
    }
    return addresses;
  }

  async mergeProjects(targetId: string, sourceId: string, addressesToInclude?: string[], companyId?: string) {
    const [target, source] = await Promise.all([this.findOne(targetId, companyId), this.findOne(sourceId, companyId)]);

    await this.prisma.$transaction(async (tx) => {
      // Move all documents from source to target
      await tx.deliveryNote.updateMany({
        where: { projectId: sourceId },
        data: { projectId: targetId },
      });
      await tx.purchaseOrder.updateMany({
        where: { projectId: sourceId },
        data: { projectId: targetId },
      });
      await tx.invoice.updateMany({
        where: { projectId: sourceId },
        data: { projectId: targetId },
      });

      // Only add addresses that the user explicitly selected
      if (addressesToInclude && addressesToInclude.length > 0) {
        for (const addr of addressesToInclude) {
          const cleaned = this.cleanAddress(addr);
          if (!cleaned) continue;
          if (this.isFuzzyMatch(this.normalizeName(cleaned), this.normalizeName(target.name))) continue;
          await tx.projectAddress.upsert({
            where: { projectId_address: { projectId: targetId, address: cleaned } },
            create: { projectId: targetId, address: cleaned },
            update: {},
          }).catch(() => {});
        }
      }

      // Delete source project (cascade deletes its ProjectAddresses)
      await tx.project.delete({ where: { id: sourceId } });
    });

    this.gateway.emitDataChanged(target.companyId, 'project', { id: targetId, merged: sourceId });

    // Trigger auto-matching after merge
    this.gateway.emitMatchingStarted(target.companyId, targetId);
    this.matchingService.autoMatch(target.companyId, { referenceOnly: true, projectId: targetId }).then((result) => {
      this.gateway.emitMatchingComplete(target.companyId, targetId, result.matchesCreated);
      this.gateway.emitDataChanged(target.companyId, 'project', { id: targetId });
    }).catch((e) => {
      this.logger.warn(`autoMatch after mergeProjects failed: ${e}`);
      this.gateway.emitMatchingComplete(target.companyId, targetId);
    });

    return this.findOne(targetId);
  }

  // --- Create from document ---

  async createFromDocument(
    companyId: string,
    documentId: string,
    documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice',
    name?: string,
  ) {
    plog(`createFromDocument() called: docType=${documentType}, docId=${documentId}, name="${name || ''}"`);
    // Extract address from document
    let doc: { parsedData: any } | null = null;
    if (documentType === 'deliveryNote') {
      doc = await this.prisma.deliveryNote.findUnique({ where: { id: documentId }, select: { parsedData: true } });
    } else if (documentType === 'purchaseOrder') {
      doc = await this.prisma.purchaseOrder.findUnique({ where: { id: documentId }, select: { parsedData: true } });
    } else {
      doc = await this.prisma.invoice.findUnique({ where: { id: documentId }, select: { parsedData: true } });
    }

    const parsed = doc?.parsedData as any;
    const rawAddr = parsed?.projectName || parsed?.deliveryAddress;
    // Always clean the name — whether user-provided or extracted from document
    const cleaned = name ? this.cleanAddress(name) : null;
    const projectName = cleaned || (rawAddr ? this.cleanAddress(rawAddr) : null) || (name?.trim() || null);
    if (!projectName) throw new NotFoundException('Could not extract project name from document');

    // Create the project
    const project = await this.prisma.project.create({
      data: { name: projectName, companyId },
    });

    // Link the document
    if (documentType === 'deliveryNote') {
      await this.prisma.deliveryNote.update({ where: { id: documentId }, data: { projectId: project.id } });
    } else if (documentType === 'purchaseOrder') {
      await this.prisma.purchaseOrder.update({ where: { id: documentId }, data: { projectId: project.id } });
    } else {
      await this.prisma.invoice.update({ where: { id: documentId }, data: { projectId: project.id } });
    }

    // Add address as secondary if different from project name
    if (rawAddr) {
      await this.addSecondaryAddress(project.id, rawAddr);
    }

    this.gateway.emitDataChanged(companyId, 'project', { id: project.id, name: project.name });

    // Trigger auto-matching after linking document to new project
    this.gateway.emitMatchingStarted(companyId, project.id);
    this.matchingService.autoMatch(companyId, { referenceOnly: true, projectId: project.id }).then((result) => {
      this.gateway.emitMatchingComplete(companyId, project.id, result.matchesCreated);
      this.gateway.emitDataChanged(companyId, 'project', { id: project.id });
    }).catch((e) => {
      this.logger.warn(`autoMatch after createFromDocument failed: ${e}`);
      this.gateway.emitMatchingComplete(companyId, project.id);
    });

    return project;
  }

  // --- Helpers (public for use by ProjectBackfillService) ---

  /** Clean a delivery address for use as project name. Returns empty string if name is garbage. */
  cleanAddress(addr: string): string {
    const result = cleanAddressUtil(addr);
    if (!result && addr.trim()) {
      this.logger.warn(`Rejected garbage project name: "${addr.slice(0, 60)}"`);
    }
    return result;
  }

  normalizeName(name: string): string {
    return normalizeNameUtil(name);
  }

  isFuzzyMatch(n1: string, n2: string): boolean {
    return isFuzzyMatchUtil(n1, n2);
  }
}
