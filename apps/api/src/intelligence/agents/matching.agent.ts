import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ProjectsService } from '../../domain/projects/projects.service';
import { SuppliersService } from '../../domain/suppliers/suppliers.service';
import type { AgentContext, ExtractionResult, MatchingResult } from './agent.types';
import type { ParsedPurchaseOrder, ParsedDeliveryNote, ParsedInvoice } from '../ocr/ocr.types';

@Injectable()
export class MatchingAgent {
  private readonly logger = new Logger(MatchingAgent.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly suppliersService: SuppliersService,
  ) {}

  async execute(context: AgentContext, extractionResult: ExtractionResult): Promise<MatchingResult> {
    this.logger.log(`[MATCH-DEBUG] Matching Agent START: type=${extractionResult.documentType}, poRef=${extractionResult.poReference}, supplier="${extractionResult.supplierName}", projectId=${context.projectId || 'null'}`);

    if (context.projectId) {
      const proj = await this.prisma.project.findUnique({
        where: { id: context.projectId },
        select: { isArchived: true },
      });
      if (proj?.isArchived) {
        this.logger.log(
          `Manual projectId ${context.projectId} archived`,
        );
        return {
          projectId: null,
          matchMethod: null,
          orphanReason: 'PROJECT_ARCHIVED',
        };
      }
      this.logger.log(
        `Matching Agent: explicit projectId=${context.projectId}`,
      );
      return { projectId: context.projectId, matchMethod: 'manual' };
    }

    if (extractionResult.poReference) {
      // Clean poReference: extract first PO-like reference, strip newlines and extra text
      const refs = extractionResult.poReference.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
      for (const ref of refs) {
        const digits = ref.replace(/\D/g, '');
        if (!digits || digits.length < 3) continue;
        const matchedPO = await this.prisma.purchaseOrder.findFirst({
          where: {
            companyId: context.companyId,
            poNumber: { contains: digits, mode: 'insensitive' },
          },
          select: { id: true, projectId: true, poNumber: true, parsedData: true },
        });

        if (matchedPO?.projectId) {
          this.logger.log(`Matching Agent: PO reference match "${ref}" → PO ${matchedPO.poNumber} → project=${matchedPO.projectId}`);
          return { projectId: matchedPO.projectId, matchMethod: 'po_reference' };
        }

        // PO found but has no project yet — create project from the PO's own parsed data.
        // Try ALL address fragments (projectName + each line of deliveryAddress) against existing projects first.
        if (matchedPO) {
          const poParsed = matchedPO.parsedData as any;
          const poProjectName = poParsed?.projectName || null;
          const poDeliveryAddr = poParsed?.deliveryAddress || null;

          // Collect all address candidates from PO.
          // Prefer deliveryAddress (full street+city) over projectName (often just city).
          // This matches the extractProjectInfo() logic used for DNs, ensuring both code paths
          // produce the same primary project name and preventing duplicate project creation
          // when concurrent workers process different documents referencing the same PO.
          const addressCandidates: string[] = [];
          if (poDeliveryAddr) {
            // Full address first (most specific, matches DN address extraction)
            const fullCleaned = this.projectsService.cleanAddress(poDeliveryAddr);
            if (fullCleaned) addressCandidates.push(fullCleaned);
            // Then individual lines as fallbacks
            for (const line of poDeliveryAddr.split(/\n/).map((l: string) => l.trim()).filter(Boolean)) {
              const cleaned = this.projectsService.cleanAddress(line);
              if (cleaned && !addressCandidates.includes(cleaned)) addressCandidates.push(cleaned);
            }
          }
          if (poProjectName) {
            const cleaned = this.projectsService.cleanAddress(poProjectName);
            if (cleaned && !addressCandidates.includes(cleaned)) addressCandidates.push(cleaned);
          }

          // First pass: try to find EXISTING project matching any candidate
          for (const candidate of addressCandidates) {
            const existing = await this.projectsService.findExisting(candidate, context.companyId);
            if (existing) {
              await this.prisma.purchaseOrder.update({
                where: { id: matchedPO.id },
                data: { projectId: existing.id },
              });
              // Add all other candidates as secondary addresses for future matching
              for (const other of addressCandidates) {
                if (other !== candidate) await this.projectsService.addSecondaryAddress(existing.id, other);
              }
              this.logger.log(`Matching Agent: PO "${matchedPO.poNumber}" matched existing project "${existing.name}" via address "${candidate}"`);
              return { projectId: existing.id, matchMethod: 'po_reference' };
            }
          }

          // No existing project found — create new from best address (prefer projectName)
          const bestAddr = addressCandidates[0];
          if (bestAddr) {
            const project = await this.projectsService.findOrCreate(bestAddr, context.companyId, poDeliveryAddr || undefined);
            if (project) {
              await this.prisma.purchaseOrder.update({
                where: { id: matchedPO.id },
                data: { projectId: project.id },
              });
              // Add remaining candidates as secondary addresses
              for (const other of addressCandidates.slice(1)) {
                await this.projectsService.addSecondaryAddress(project.id, other);
              }
              this.logger.log(`Matching Agent: PO "${matchedPO.poNumber}" had no project — created "${project.name}" from PO data`);
              return { projectId: project.id, matchMethod: 'po_reference' };
            }
          }
          this.logger.warn(`Matching Agent: PO "${matchedPO.poNumber}" found but has no project and no usable address`);
        }
      }
    }

    // DN reference matching: invoices that reference delivery note numbers
    if (extractionResult.documentType === 'invoice') {
      const parsedInv = extractionResult.parsedData as ParsedInvoice;
      const dnRefs = parsedInv?.deliveryNoteReferences || [];
      if (dnRefs.length > 0) {
        for (const dnRef of dnRefs) {
          const trimmedRef = dnRef.trim();
          if (!trimmedRef) continue;
          let matchedDN = await this.prisma.deliveryNote.findFirst({
            where: {
              companyId: context.companyId,
              noteNumber: trimmedRef,
              projectId: { not: null },
              project: { isArchived: false },
            },
            select: { projectId: true, noteNumber: true },
          });
          if (!matchedDN) {
            const digits = trimmedRef.replace(/\D/g, '');
            if (digits && digits.length >= 3) {
              matchedDN = await this.prisma.deliveryNote.findFirst({
                where: {
                  companyId: context.companyId,
                  noteNumber: { contains: digits, mode: 'insensitive' },
                  projectId: { not: null },
                  project: { isArchived: false },
                },
                select: { projectId: true, noteNumber: true },
              });
            }
          }
          if (matchedDN?.projectId) {
            this.logger.log(`Matching Agent: DN reference "${trimmedRef}" → DN ${matchedDN.noteNumber} → project=${matchedDN.projectId}`);
            return { projectId: matchedDN.projectId, matchMethod: 'dn_reference' };
          }
        }
        this.logger.log(`Matching Agent: Invoice has DN refs [${dnRefs.join(', ')}] but no matching DN with project found`);
      }
    }

    const projectInfo = this.extractProjectInfo(extractionResult);
    const isQuote = extractionResult.documentType === 'purchase_order' &&
      (extractionResult.parsedData as any)?.documentSubtype === 'price_quote';

    // Clean the project name (strip contact info, phones, noise from multi-line addresses)
    const cleanedName = projectInfo ? this.projectsService.cleanAddress(projectInfo.name) : null;

    this.logger.log(`Matching Agent: extractProjectInfo → name="${projectInfo?.name || 'null'}" secondary="${projectInfo?.secondaryAddress || 'null'}" cleaned="${cleanedName || 'null'}"`);

    // ADDRESS-BASED MATCHING FIRST — a supplier can deliver to multiple projects,
    // so address takes priority over supplier when available.

    // Real POs: address-based matching/creation (quotes skip this)
    if (extractionResult.documentType === 'purchase_order' && !isQuote) {
      if (cleanedName) {
        const project = await this.projectsService.findOrCreate(cleanedName, context.companyId, projectInfo?.rawAddress);
        if (project) {
          if (projectInfo?.name) await this.projectsService.upgradeNameIfBetter(project.id, projectInfo.name);
          if (projectInfo?.secondaryAddress) {
            await this.projectsService.upgradeNameIfBetter(project.id, projectInfo.secondaryAddress);
            await this.projectsService.addSecondaryAddress(project.id, projectInfo.secondaryAddress);
          }
          this.logger.log(`Matching Agent: PO matched/created project "${project.name}"`);
          return { projectId: project.id, matchMethod: 'address_match' };
        }
      }
    }

    // DNs with deliveryAddress: auto-create project (same as POs)
    if (extractionResult.documentType === 'delivery_note' && cleanedName) {
      const project = await this.projectsService.findOrCreate(cleanedName, context.companyId, projectInfo?.rawAddress);
      if (project) {
        if (projectInfo?.name) await this.projectsService.upgradeNameIfBetter(project.id, projectInfo.name);
        if (projectInfo?.secondaryAddress) {
          await this.projectsService.upgradeNameIfBetter(project.id, projectInfo.secondaryAddress);
          await this.projectsService.addSecondaryAddress(project.id, projectInfo.secondaryAddress);
        }
        this.logger.log(`Matching Agent: DN matched/created project "${project.name}"`);
        return { projectId: project.id, matchMethod: 'address_match' };
      }
    }

    // Address match for invoices/quotes (never auto-create)
    if (cleanedName && (extractionResult.documentType === 'invoice' || isQuote)) {
      const project = await this.projectsService.findExisting(cleanedName, context.companyId);
      if (project) {
        if (projectInfo?.secondaryAddress) {
          await this.projectsService.addSecondaryAddress(project.id, projectInfo.secondaryAddress);
        }
        this.logger.log(`Matching Agent: Matched to existing project "${project.name}" from ${extractionResult.documentType}`);
        return { projectId: project.id, matchMethod: 'address_match' };
      }
    }

    // SUPPLIER-BASED FALLBACK — only when no address is available or address matching didn't find/create a project.
    // A supplier can serve multiple projects, so this is a last resort.
    const supplierProjectId = await this.findProjectBySupplier(extractionResult.supplierName, context.companyId);
    if (supplierProjectId) {
      this.logger.log(`Matching Agent: Supplier-based fallback → project=${supplierProjectId}`);
      return { projectId: supplierProjectId, matchMethod: 'supplier' };
    }

    this.logger.warn(`Matching Agent: No project match found for supplier="${extractionResult.supplierName}"`);
    return {
      projectId: null,
      matchMethod: null,
      orphanReason: extractionResult.poReference ? 'NO_PO_MATCH' : 'UNKNOWN_PROJECT',
    };
  }

  /**
   * Extract the best available project name and optional secondary address.
   * Priority: projectName > deliveryAddress (projectName is typically cleaner and more specific,
   * while deliveryAddress often contains noise like contact info or warehouse names).
   * When both exist and differ, the secondary is stored for fuzzy matching purposes.
   */
  private extractProjectInfo(extractionResult: ExtractionResult): { name: string; secondaryAddress?: string; rawAddress?: string } | null {
    const parsed = extractionResult.parsedData as any;
    if (!parsed) return null;

    let deliveryAddress: string | null = null;
    let projectName: string | null = null;

    if (extractionResult.documentType === 'purchase_order') {
      const po = parsed as ParsedPurchaseOrder;
      deliveryAddress = po.deliveryAddress || null;
      projectName = po.projectName || null;
    } else if (extractionResult.documentType === 'delivery_note') {
      const dn = parsed as ParsedDeliveryNote;
      deliveryAddress = dn.deliveryAddress || null;
      projectName = dn.projectName || null;
    }

    // Raw site/delivery address (uncleaned) — stored on the project so the UI
    // can show a "site location" instead of "not defined".
    const rawAddress = deliveryAddress || projectName || undefined;

    // If one field contains the other, always use the longer (more specific) one.
    // e.g. deliveryAddress="יגיע כפיים 20 פתח תקווה" contains projectName="פתח תקווה"
    if (deliveryAddress && projectName && deliveryAddress !== projectName) {
      const daNorm = deliveryAddress.replace(/[,\-\/]/g, ' ').replace(/\s+/g, ' ').trim();
      const pnNorm = projectName.replace(/[,\-\/]/g, ' ').replace(/\s+/g, ' ').trim();
      if (daNorm.includes(pnNorm)) return { name: deliveryAddress, rawAddress };
      if (pnNorm.includes(daNorm)) return { name: projectName, rawAddress };
    }

    // Prefer deliveryAddress — it typically contains the full site location
    // (street + city like "יגיע כפיים 20 פתח תקווה"), which makes a better
    // project name than just a city from projectName (e.g. "פתח תקווה").
    // Only fall back to projectName when deliveryAddress is missing or English-only.
    const hasHebrew = (s: string) => /[\u0590-\u05FF]{3,}/.test(s);
    const useDeliveryAddress = deliveryAddress && hasHebrew(deliveryAddress);
    const useProjectName = projectName && hasHebrew(projectName);

    const primary = useDeliveryAddress
      ? deliveryAddress
      : (useProjectName ? projectName : (deliveryAddress || projectName));
    if (!primary) return null;

    const secondary = primary !== deliveryAddress && deliveryAddress ? deliveryAddress
      : primary !== projectName && projectName ? projectName
      : undefined;

    return { name: primary, secondaryAddress: secondary, rawAddress };
  }

  /**
   * Find a project by looking at other documents from the same supplier.
   * A supplier can serve MANY sites, so this only commits when every document
   * from that supplier points at exactly ONE active project. When the supplier
   * spans multiple projects the result is ambiguous and we return null (the
   * document stays an orphan / is resolved later by address or references)
   * rather than collapsing everything into one arbitrary project — that
   * arbitrary collapse was the root cause of demo over-grouping.
   */
  private async findProjectBySupplier(supplierName: string | undefined, companyId: string): Promise<string | null> {
    if (!supplierName || supplierName === 'Unknown') return null;

    const projectIds = await this.distinctProjectIdsForSupplier(supplierName, companyId);
    if (projectIds.size === 1) return [...projectIds][0];
    if (projectIds.size > 1) {
      this.logger.log(`findProjectBySupplier: "${supplierName}" spans ${projectIds.size} active projects — skipping ambiguous supplier fallback`);
    }
    return null;
  }

  /** Distinct active project ids that already carry a document from this supplier. */
  private async distinctProjectIdsForSupplier(supplierName: string, companyId: string): Promise<Set<string>> {
    const projectIds = new Set<string>();
    const add = (rows: Array<{ projectId: string | null }>) => {
      for (const r of rows) if (r.projectId) projectIds.add(r.projectId);
    };
    const byName = { contains: supplierName, mode: 'insensitive' as const };
    const base = { companyId, projectId: { not: null }, project: { isArchived: false } };
    const [pos, dns, invs] = await Promise.all([
      this.prisma.purchaseOrder.findMany({ where: { ...base, supplierName: byName }, select: { projectId: true }, take: 10 }),
      this.prisma.deliveryNote.findMany({ where: { ...base, supplierName: byName }, select: { projectId: true }, take: 10 }),
      this.prisma.invoice.findMany({ where: { ...base, supplierName: byName }, select: { projectId: true }, take: 10 }),
    ]);
    add(pos); add(dns); add(invs);

    // Resolve via SuppliersService (transliteration, aliases, fuzzy) and search by supplierId.
    try {
      const resolved = await this.suppliersService.findOrCreate(supplierName, companyId);
      if (resolved) {
        const byId = { companyId, supplierId: resolved.id, projectId: { not: null }, project: { isArchived: false } };
        const [p2, d2, i2] = await Promise.all([
          this.prisma.purchaseOrder.findMany({ where: byId, select: { projectId: true }, take: 10 }),
          this.prisma.deliveryNote.findMany({ where: byId, select: { projectId: true }, take: 10 }),
          this.prisma.invoice.findMany({ where: byId, select: { projectId: true }, take: 10 }),
        ]);
        add(p2); add(d2); add(i2);
      }
    } catch (err) {
      this.logger.warn(`distinctProjectIdsForSupplier: supplier resolution failed for "${supplierName}": ${err}`);
    }
    return projectIds;
  }
}
