import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AutoMatchContext } from './matching.types';
import { normalizeSupplierName, isSameSupplier } from './supplier-matcher';

/** Build a lookup from normalized alias → canonical normalized supplier name */
export function buildAliasIndex(suppliers: { name: string; aliases: string[] }[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const s of suppliers) {
    const normName = normalizeSupplierName(s.name);
    for (const alias of s.aliases || []) {
      index.set(normalizeSupplierName(alias), normName);
    }
  }
  return index;
}

@Injectable()
export class SupplierMatchService {
  private readonly logger = new Logger(SupplierMatchService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // --- Strategy 2: Fuzzy supplier name grouping ---
  async matchBySupplier(ctx: AutoMatchContext) {
    const remainingPOs = ctx.unmatchedPOs.filter((po) => !ctx.matchedPOSet.has(po.id));
    const remainingDNs = ctx.unmatchedDNs.filter((dn) => !ctx.matchedDNSet.has(dn.id));
    const remainingInvs = ctx.unmatchedInvoices.filter((inv) => !ctx.matchedInvSet.has(inv.id));

    // Reuse pre-loaded suppliers from context when available
    const allSuppliers = ctx.cachedSuppliers ?? await this.prisma.supplier.findMany({
      where: { companyId: ctx.companyId },
      select: { id: true, name: true, aliases: true },
    });

    const aliasIndex = ctx.cachedAliasIndex ?? buildAliasIndex(allSuppliers);

    const supplierGroups = new Map<string, { pos: any[]; dns: any[]; invs: any[] }>();
    const supplierIdToKey = new Map<string, string>();
    const groupSupplierIds = new Map<string, string>();

    const assignToGroup = (doc: { supplierName: string; supplierId?: string | null }) => {
      if (doc.supplierId) {
        const existingKey = supplierIdToKey.get(doc.supplierId);
        if (existingKey && supplierGroups.has(existingKey)) return existingKey;
      }
      let normalized = normalizeSupplierName(doc.supplierName);

      const aliasTarget = aliasIndex.get(normalized);
      if (aliasTarget) normalized = aliasTarget;

      for (const [key] of supplierGroups) {
        if (!isSameSupplier(key, normalized)) continue;
        const groupSid = groupSupplierIds.get(key);
        if (doc.supplierId && groupSid && doc.supplierId !== groupSid) continue;
        if (doc.supplierId) {
          supplierIdToKey.set(doc.supplierId, key);
          if (!groupSid) groupSupplierIds.set(key, doc.supplierId);
        }
        return key;
      }
      if (doc.supplierId) {
        supplierIdToKey.set(doc.supplierId, normalized);
        groupSupplierIds.set(normalized, doc.supplierId);
      }
      return normalized;
    };

    for (const po of remainingPOs) {
      const key = assignToGroup(po);
      if (!supplierGroups.has(key)) supplierGroups.set(key, { pos: [], dns: [], invs: [] });
      supplierGroups.get(key)!.pos.push(po);
    }
    for (const dn of remainingDNs) {
      const key = assignToGroup(dn);
      if (!supplierGroups.has(key)) supplierGroups.set(key, { pos: [], dns: [], invs: [] });
      supplierGroups.get(key)!.dns.push(dn);
    }
    for (const inv of remainingInvs) {
      const key = assignToGroup(inv);
      if (!supplierGroups.has(key)) supplierGroups.set(key, { pos: [], dns: [], invs: [] });
      supplierGroups.get(key)!.invs.push(inv);
    }

    await this.relocateSubSupplierDNs(supplierGroups, ctx.companyName);

    for (const [, group] of supplierGroups) {
      // Only form a match when the supplier group resolves to a SINGLE purchase order. These
      // are reference-less leftovers, so with one PO the attribution is unambiguous. When a
      // supplier has several POs we cannot tell which order each reference-less DN/invoice
      // belongs to — collapsing them onto one "best" PO summed unrelated orders together
      // (mega-match). Leave such documents for the orphan + same-project steps to place.
      if (group.pos.length > 1) {
        this.logger.log(
          `Supplier group has ${group.pos.length} POs — left for per-order resolution (no supplier collapse)`,
        );
        continue;
      }

      const po = group.pos[0] || null;
      const docCount = (po ? 1 : 0) + (group.dns.length > 0 ? 1 : 0) + (group.invs.length > 0 ? 1 : 0);
      if (docCount < 2) continue;

      if (po) ctx.matchedPOSet.add(po.id);
      for (const dn of group.dns) ctx.matchedDNSet.add(dn.id);
      for (const inv of group.invs) ctx.matchedInvSet.add(inv.id);
      await this.createMatch(ctx, po, group.dns, group.invs);
    }
  }

  /**
   * Sub-supplier detection: when a DN's customerName matches a PO group's supplier,
   * the DN was shipped by a sub-supplier. Move it to the primary supplier's group.
   * GUARD: Skip if customerName matches the company's own name.
   */
  private async relocateSubSupplierDNs(
    supplierGroups: Map<string, { pos: any[]; dns: any[]; invs: any[] }>,
    companyName: string | null,
  ) {
    for (const [key, group] of supplierGroups) {
      if (group.pos.length > 0) continue;

      const dnsToMove: { dn: any; targetKey: string; targetSupplierId: string | null; targetSupplierName: string }[] = [];
      for (const dn of group.dns) {
        const customerName = (dn.parsedData as any)?.customerName;
        if (!customerName) continue;
        if (companyName && isSameSupplier(customerName, companyName)) continue;

        for (const [targetKey, targetGroup] of supplierGroups) {
          if (targetKey === key || targetGroup.pos.length === 0) continue;
          const targetSupplierName = targetGroup.pos[0].supplierName;
          if (isSameSupplier(customerName, targetSupplierName)) {
            dnsToMove.push({
              dn, targetKey,
              targetSupplierId: targetGroup.pos[0].supplierId || null,
              targetSupplierName,
            });
            break;
          }
        }
      }

      for (const { dn, targetKey, targetSupplierId, targetSupplierName } of dnsToMove) {
        group.dns = group.dns.filter((d: any) => d.id !== dn.id);
        supplierGroups.get(targetKey)!.dns.push(dn);
        this.logger.log(
          `Sub-supplier: moved DN ${(dn as any).noteNumber || dn.id} ` +
          `from "${dn.supplierName}" to "${targetSupplierName}"`,
        );
        if (targetSupplierId) {
          await this.prisma.deliveryNote.update({
            where: { id: dn.id },
            data: { supplierId: targetSupplierId, supplierName: targetSupplierName },
          });
        }
      }
    }

    for (const [key, group] of supplierGroups) {
      if (group.pos.length === 0 && group.dns.length === 0 && group.invs.length === 0) {
        supplierGroups.delete(key);
      }
    }
  }

  async createMatch(ctx: AutoMatchContext, po: any | null, dns: any[], invs: any[]) {
    // Skip computeDiscrepancies here — recomputeModifiedMatches handles it once
    const match = await this.prisma.threeWayMatch.create({
      data: {
        companyId: (po || dns[0] || invs[0])!.companyId,
        purchaseOrderId: po?.id,
        deliveryNotes: dns.length > 0 ? { connect: dns.map((dn) => ({ id: dn.id })) } : undefined,
        invoices: invs.length > 0 ? { connect: invs.map((i) => ({ id: i.id })) } : undefined,
        status: 'PARTIAL', discrepancies: [], lineItemPairings: [], matchedAt: new Date(),
      },
    });
    ctx.created.push(match.id);
  }
}
