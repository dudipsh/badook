import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AutoMatchContext } from './matching.types';
import { normalizeSupplierName, isSameSupplier } from './supplier-matcher';
import { buildAliasIndex } from './supplier-match.service';

@Injectable()
export class OrphanConsolidatorService {
  private readonly logger = new Logger(OrphanConsolidatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Generate the next temporary PO number (T-100001, T-100002, ...) */
  async generateTempPoNumber(companyId: string): Promise<string> {
    const latest = await this.prisma.threeWayMatch.findFirst({
      where: { companyId, tempPoNumber: { not: null } },
      orderBy: { tempPoNumber: 'desc' },
      select: { tempPoNumber: true },
    });
    const lastNum = latest?.tempPoNumber
      ? parseInt(latest.tempPoNumber.replace('T-', ''), 10)
      : 100000;
    return `T-${lastNum + 1}`;
  }

  // --- Strategy 3: Consolidate orphaned documents ---
  async consolidateOrphans(ctx: AutoMatchContext) {
    const allMatchSuppliers = new Map<string, { name: string; supplierId: string | null }>();

    // Use pre-loaded cache from auto-match context when available
    const existingMatches = ctx.cachedMatches ?? await this.prisma.threeWayMatch.findMany({
      where: { companyId: ctx.companyId },
      include: { purchaseOrder: true, deliveryNotes: true, invoices: true },
    });
    for (const m of existingMatches) {
      const firstDoc = m.purchaseOrder || m.deliveryNotes?.[0] || m.invoices?.[0];
      if (firstDoc?.supplierName) {
        allMatchSuppliers.set(m.id, {
          name: firstDoc.supplierName,
          supplierId: (firstDoc as any)?.supplierId || null,
        });
      }
    }

    const allSuppliers = ctx.cachedSuppliers ?? await this.prisma.supplier.findMany({
      where: { companyId: ctx.companyId },
      select: { id: true, name: true, aliases: true },
    });
    const aliasIndex = ctx.cachedAliasIndex ?? buildAliasIndex(allSuppliers);

    const findMatchForSupplier = (doc: { supplierName: string; supplierId?: string | null }): string | null => {
      if (doc.supplierId) {
        for (const [matchId, info] of allMatchSuppliers) {
          if (info.supplierId === doc.supplierId) return matchId;
        }
      }

      let resolvedName = doc.supplierName;
      const normalizedDocName = normalizeSupplierName(doc.supplierName);
      const aliasTarget = aliasIndex.get(normalizedDocName);
      if (aliasTarget) {
        const canonicalSupplier = allSuppliers.find((s) => normalizeSupplierName(s.name) === aliasTarget);
        if (canonicalSupplier) resolvedName = canonicalSupplier.name;
      }

      for (const [matchId, info] of allMatchSuppliers) {
        if (doc.supplierId && info.supplierId && doc.supplierId !== info.supplierId) continue;
        if (isSameSupplier(info.name, resolvedName)) return matchId;
      }
      return null;
    };

    // Orphaned POs
    for (const po of ctx.unmatchedPOs) {
      if (ctx.matchedPOSet.has(po.id)) continue;
      const existingMatchId = findMatchForSupplier(po);
      if (existingMatchId) {
        const existing = await this.prisma.threeWayMatch.findUnique({
          where: { id: existingMatchId },
          select: { purchaseOrderId: true },
        });
        // Only adopt a PO-less match (e.g. a DN/invoice-only match of the same supplier).
        // If the match already has a PO, this orphan PO is a DIFFERENT order — it must get its
        // own match, never share the other PO's delivery notes/invoices (that summed unrelated
        // orders together and produced nonsense reconciled totals).
        if (existing && !existing.purchaseOrderId) {
          await this.prisma.threeWayMatch.update({
            where: { id: existingMatchId },
            data: { purchaseOrderId: po.id, tempPoNumber: null },
          });
          ctx.updatedMatchIds.add(existingMatchId);
          continue;
        }
      }
      const match = await this.prisma.threeWayMatch.create({
        data: { companyId: po.companyId, purchaseOrderId: po.id, status: 'PARTIAL' },
      });
      ctx.created.push(match.id);
      allMatchSuppliers.set(match.id, { name: po.supplierName, supplierId: po.supplierId });
    }

    // Orphaned DNs
    for (const dn of ctx.unmatchedDNs) {
      if (ctx.matchedDNSet.has(dn.id)) continue;
      let existingMatchId = findMatchForSupplier(dn);

      // Sub-supplier check
      if (!existingMatchId) {
        const customerName = (dn.parsedData as any)?.customerName;
        if (customerName && !(ctx.companyName && isSameSupplier(customerName, ctx.companyName))) {
          existingMatchId = findMatchForSupplier({ supplierName: customerName, supplierId: null });
          if (existingMatchId) {
            const matchInfo = allMatchSuppliers.get(existingMatchId);
            if (matchInfo?.supplierId) {
              await this.prisma.deliveryNote.update({
                where: { id: dn.id },
                data: { supplierId: matchInfo.supplierId, supplierName: matchInfo.name },
              });
            }
            this.logger.log(
              `Sub-supplier orphan: DN ${(dn as any).noteNumber || dn.id} ` +
              `customer "${customerName}" matched supplier "${matchInfo?.name}"`,
            );
          }
        }
      }

      if (existingMatchId) {
        await this.prisma.threeWayMatch.update({
          where: { id: existingMatchId },
          data: { deliveryNotes: { connect: [{ id: dn.id }] } },
        });
        ctx.updatedMatchIds.add(existingMatchId);
        continue;
      }
      const tempPoNumber = await this.generateTempPoNumber(dn.companyId);
      const match = await this.prisma.threeWayMatch.create({
        data: {
          companyId: dn.companyId,
          deliveryNotes: { connect: [{ id: dn.id }] },
          status: 'PARTIAL',
          tempPoNumber,
        },
      });
      ctx.created.push(match.id);
      allMatchSuppliers.set(match.id, { name: dn.supplierName, supplierId: dn.supplierId });
    }

    // Orphaned Invoices
    for (const inv of ctx.unmatchedInvoices) {
      if (ctx.matchedInvSet.has(inv.id)) continue;
      const existingMatchId = findMatchForSupplier(inv);
      if (existingMatchId) {
        await this.prisma.threeWayMatch.update({
          where: { id: existingMatchId },
          data: { invoices: { connect: [{ id: inv.id }] } },
        });
        ctx.updatedMatchIds.add(existingMatchId);
        continue;
      }
      const tempPoNumberInv = await this.generateTempPoNumber(inv.companyId);
      const match = await this.prisma.threeWayMatch.create({
        data: {
          companyId: inv.companyId,
          invoices: { connect: [{ id: inv.id }] },
          status: 'PARTIAL',
          tempPoNumber: tempPoNumberInv,
        },
      });
      ctx.created.push(match.id);
      allMatchSuppliers.set(match.id, { name: inv.supplierName, supplierId: inv.supplierId });
    }
  }

  // --- Strategy 4: Merge existing same-supplier matches ---
  async mergeSameSupplierMatches(ctx: AutoMatchContext) {
    // Must re-query matches since consolidateOrphans may have created/updated/deleted them
    const allMatches = await this.prisma.threeWayMatch.findMany({
      where: { companyId: ctx.companyId },
      include: { purchaseOrder: true, deliveryNotes: true, invoices: true },
    });

    // Reuse pre-loaded suppliers (they don't change during the auto-match run)
    const suppliersWithAliases = ctx.cachedSuppliers ?? await this.prisma.supplier.findMany({
      where: { companyId: ctx.companyId },
      select: { id: true, name: true, aliases: true },
    });
    const mergeAliasIndex = ctx.cachedAliasIndex ?? buildAliasIndex(suppliersWithAliases);

    const supplierMatchMap = new Map<string, typeof allMatches>();

    // Two-pass grouping: first pass adds matches with PO (so their supplier keys exist),
    // second pass adds matches without PO (with sub-supplier detection).
    // This prevents ordering issues where DN-only matches are processed before PO matches.
    const matchesWithPO = allMatches.filter((m) => m.purchaseOrder);
    const matchesWithoutPO = allMatches.filter((m) => !m.purchaseOrder);

    for (const m of [...matchesWithPO, ...matchesWithoutPO]) {
      const firstDoc = m.purchaseOrder || m.deliveryNotes?.[0] || m.invoices?.[0];
      if (!firstDoc) continue;

      const supplierId = (firstDoc as any).supplierId;
      let supplierName = firstDoc.supplierName;
      if (!supplierName) continue;

      const normalizedName = normalizeSupplierName(supplierName);
      const aliasResolved = mergeAliasIndex.get(normalizedName);
      if (aliasResolved) {
        const canonicalSupplier = suppliersWithAliases.find(
          (s) => normalizeSupplierName(s.name) === aliasResolved,
        );
        if (canonicalSupplier) supplierName = canonicalSupplier.name;
      }

      // Sub-supplier detection for merge grouping:
      // DN from distributor (e.g. "טובול") may have customerName = real supplier (e.g. "מזל סטיל")
      if (!m.purchaseOrder && m.deliveryNotes?.length > 0) {
        for (const dn of m.deliveryNotes) {
          const customerName = (dn.parsedData as any)?.customerName;
          if (!customerName) continue;
          if (ctx.companyName && isSameSupplier(customerName, ctx.companyName)) continue;
          for (const [key] of supplierMatchMap) {
            if (isSameSupplier(key, customerName)) {
              supplierName = customerName;
              break;
            }
          }
          if (supplierName !== firstDoc.supplierName) break;
        }
      }

      let foundKey: string | null = null;
      if (supplierId) {
        for (const [key, matches] of supplierMatchMap) {
          const keyDoc = matches[0].purchaseOrder || matches[0].deliveryNotes?.[0] || matches[0].invoices?.[0];
          if (keyDoc && (keyDoc as any).supplierId === supplierId) { foundKey = key; break; }
        }
      }
      if (!foundKey) {
        for (const [key] of supplierMatchMap) {
          if (isSameSupplier(key, supplierName)) { foundKey = key; break; }
        }
      }

      const groupKey = foundKey || normalizeSupplierName(supplierName);
      if (!supplierMatchMap.has(groupKey)) supplierMatchMap.set(groupKey, []);
      supplierMatchMap.get(groupKey)!.push(m);
    }

    for (const [supplier, matches] of supplierMatchMap) {
      if (matches.length <= 1) continue;

      const withPO = matches.filter((m) => m.purchaseOrderId);
      const withoutPO = matches.filter((m) => !m.purchaseOrderId);

      if (withPO.length === 0 || withoutPO.length === 0) continue;

      for (const orphan of withoutPO) {
        const primary = this.findBestPoMatchForOrphan(orphan, withPO);

        const primarySupplierId = (primary.purchaseOrder as any)?.supplierId;
        const primarySupplierName = primary.purchaseOrder?.supplierName;

        // First disconnect all docs from orphan, then connect to primary, then delete orphan.
        // Using sequential operations to avoid Prisma implicit m2m issues.
        const dnIds = orphan.deliveryNotes.map((dn: any) => dn.id);
        const invIds = orphan.invoices.map((inv: any) => inv.id);

        // Disconnect from orphan
        if (dnIds.length > 0) {
          await this.prisma.threeWayMatch.update({
            where: { id: orphan.id },
            data: { deliveryNotes: { disconnect: dnIds.map((id: string) => ({ id })) } },
          });
        }
        if (invIds.length > 0) {
          await this.prisma.threeWayMatch.update({
            where: { id: orphan.id },
            data: { invoices: { disconnect: invIds.map((id: string) => ({ id })) } },
          });
        }

        // Connect to primary + update suppliers + delete orphan in a single transaction
        const mergeOps: any[] = [];
        if (dnIds.length > 0) {
          mergeOps.push(
            this.prisma.threeWayMatch.update({
              where: { id: primary.id },
              data: { deliveryNotes: { connect: dnIds.map((id: string) => ({ id })) } },
            }),
          );
        }
        if (invIds.length > 0) {
          mergeOps.push(
            this.prisma.threeWayMatch.update({
              where: { id: primary.id },
              data: { invoices: { connect: invIds.map((id: string) => ({ id })) } },
            }),
          );
        }
        // Unify supplier IDs
        for (const dn of orphan.deliveryNotes) {
          if (primarySupplierId && dn.supplierId !== primarySupplierId) {
            mergeOps.push(
              this.prisma.deliveryNote.update({
                where: { id: dn.id },
                data: { supplierId: primarySupplierId, supplierName: primarySupplierName || dn.supplierName },
              }),
            );
          }
        }
        mergeOps.push(this.prisma.threeWayMatch.delete({ where: { id: orphan.id } }));
        await this.prisma.$transaction(mergeOps);

        this.logger.log(
          `Merged orphan match ${orphan.id} into ${primary.id} ` +
          `(PO ${primary.purchaseOrder?.poNumber}) for supplier "${supplier}"`,
        );
        ctx.updatedMatchIds.add(primary.id);
      }
    }
  }

  /** Find the best PO match for an orphan, scored by total amount similarity */
  private findBestPoMatchForOrphan(orphan: any, poMatches: any[]): any {
    if (poMatches.length === 1) return poMatches[0];

    const orphanTotal = this.computeMatchTotal(orphan);

    let bestMatch = poMatches[0];
    let bestScore = -1;

    for (const pm of poMatches) {
      let score = 0;
      const poTotal = Number(pm.purchaseOrder?.totalAmount) || 0;

      if (orphanTotal > 0 && poTotal > 0) {
        score += (Math.min(orphanTotal, poTotal) / Math.max(orphanTotal, poTotal)) * 100;
      }

      const orphanItemCount = (orphan.deliveryNotes?.flatMap((d: any) => d.lineItems || []).length || 0)
        + (orphan.invoices?.flatMap((i: any) => i.lineItems || []).length || 0);
      const poItemCount = pm.purchaseOrder?.lineItems?.length || 0;
      if (orphanItemCount > 0 && poItemCount > 0) {
        score += (Math.min(orphanItemCount, poItemCount) / Math.max(orphanItemCount, poItemCount)) * 30;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = pm;
      }
    }

    return bestMatch;
  }

  /**
   * Strategy 5: Same-project merge — merge DN-only matches into PO matches
   * when both are in the same project. In Israeli construction, the buyer orders
   * from supplier A (PO), but delivery comes from distributor B (DN).
   * Different suppliers, but same project = same order.
   */
  async mergeWithinProject(ctx: AutoMatchContext) {
    const allMatches = await this.prisma.threeWayMatch.findMany({
      where: { companyId: ctx.companyId },
      include: {
        purchaseOrder: true,
        deliveryNotes: { include: { lineItems: true } },
        invoices: { include: { lineItems: true } },
      },
    });

    const withPO = allMatches.filter((m) => m.purchaseOrderId && m.purchaseOrder?.projectId);
    const withoutPO = allMatches.filter((m) => !m.purchaseOrderId && m.deliveryNotes?.length > 0);

    for (const orphan of withoutPO) {
      // Get the projectId from the orphan's DNs
      const orphanProjectIds = new Set(
        orphan.deliveryNotes.map((dn) => dn.projectId).filter(Boolean),
      );
      if (orphanProjectIds.size === 0) continue;

      // Find a PO match in the same project
      const sameProjectPO = withPO.find((m) =>
        orphanProjectIds.has(m.purchaseOrder!.projectId),
      );
      if (!sameProjectPO) continue;

      // Disconnect docs from orphan first, then connect to primary
      const dnIds = orphan.deliveryNotes.map((dn: any) => dn.id);
      const invIds = orphan.invoices.map((inv: any) => inv.id);

      if (dnIds.length > 0) {
        await this.prisma.threeWayMatch.update({
          where: { id: orphan.id },
          data: { deliveryNotes: { disconnect: dnIds.map((id: string) => ({ id })) } },
        });
      }
      if (invIds.length > 0) {
        await this.prisma.threeWayMatch.update({
          where: { id: orphan.id },
          data: { invoices: { disconnect: invIds.map((id: string) => ({ id })) } },
        });
      }

      const mergeOps: any[] = [];
      if (dnIds.length > 0) {
        mergeOps.push(
          this.prisma.threeWayMatch.update({
            where: { id: sameProjectPO.id },
            data: { deliveryNotes: { connect: dnIds.map((id: string) => ({ id })) } },
          }),
        );
      }
      if (invIds.length > 0) {
        mergeOps.push(
          this.prisma.threeWayMatch.update({
            where: { id: sameProjectPO.id },
            data: { invoices: { connect: invIds.map((id: string) => ({ id })) } },
          }),
        );
      }
      mergeOps.push(this.prisma.threeWayMatch.delete({ where: { id: orphan.id } }));
      await this.prisma.$transaction(mergeOps);

      this.logger.log(
        `[same-project-merge] Merged orphan match ${orphan.id} (${orphan.deliveryNotes.length} DNs) ` +
        `into ${sameProjectPO.id} (PO ${sameProjectPO.purchaseOrder?.poNumber}) — same project`,
      );
      ctx.updatedMatchIds.add(sameProjectPO.id);
    }
  }

  private computeMatchTotal(match: any): number {
    const dnTotal = (match.deliveryNotes || []).reduce(
      (s: number, dn: any) => s + (Number(dn.totalAmount) || 0), 0,
    );
    const invTotal = (match.invoices || []).reduce(
      (s: number, inv: any) => s + (Number(inv.totalAmount) || 0), 0,
    );
    return invTotal || dnTotal;
  }
}
