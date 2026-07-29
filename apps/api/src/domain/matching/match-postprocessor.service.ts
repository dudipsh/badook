import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DiscrepancyService } from './discrepancy.service';
import { AutoMatchContext } from './matching.types';

interface PairingRef {
  id?: string;
  catalogNumber?: string;
  description?: string;
  quantity?: number;
  index?: number;
}

interface LineItem {
  id: string;
  description?: string | null;
  catalogNumber?: string | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  quantity?: number | null;
  sortOrder?: number;
  priceSource?: string | null;
}

@Injectable()
export class MatchPostprocessorService {
  private readonly logger = new Logger(MatchPostprocessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discrepancyService: DiscrepancyService,
  ) {}

  async recomputeModifiedMatches(ctx: AutoMatchContext) {
    const matchIds = new Set([...ctx.created, ...ctx.updatedMatchIds]);
    for (const matchId of matchIds) {
      const m = await this.prisma.threeWayMatch.findUnique({
        where: { id: matchId },
        include: {
          purchaseOrder: { include: { lineItems: true } },
          deliveryNotes: { include: { lineItems: true } },
          invoices: { include: { lineItems: true } },
        },
      });
      if (!m) continue;
      const po = m.purchaseOrder;
      const dns = m.deliveryNotes || [];
      const invs = m.invoices || [];
      const docCount = (po ? 1 : 0) + (dns.length > 0 ? 1 : 0) + (invs.length > 0 ? 1 : 0);
      if (docCount < 2) continue;

      // Phase 1: Compute initial pairings (needed for backfill) — includes AI matching
      const initialResult = await this.discrepancyService.computeDiscrepancies(po, dns, invs, ctx.companyId);

      // Phase 2: Backfill DN prices from PO using pairings
      let didBackfill = false;
      if (po && dns.length > 0 && initialResult.pairings) {
        didBackfill = await this.backfillPricesFromPO(matchId, po, dns, initialResult.pairings as any[]);
      }

      // Phase 3: If backfill updated prices, recompute only price-related discrepancies
      // (pairings don't change — only prices were backfilled, so skip expensive AI re-matching)
      let finalResult = initialResult;
      if (didBackfill) {
        finalResult = this.recomputePriceDiscrepancies(initialResult, po, dns, invs);
      }

      const allPresent = po && dns.length > 0 && invs.length > 0;
      const status = finalResult.discrepancies.some((d) => d.severity === 'CRITICAL' || d.severity === 'WARNING')
        ? 'DISCREPANCY' : allPresent ? 'MATCHED' : 'PARTIAL';

      await this.prisma.threeWayMatch.update({
        where: { id: matchId },
        data: { status, discrepancies: finalResult.discrepancies as any, lineItemPairings: finalResult.pairings as any, matchedAt: new Date() },
      });
    }
  }

  /**
   * After price backfill, recompute only price-related discrepancies without re-running AI matching.
   * The pairings stay the same — only DN prices changed, so we recalculate total amounts and price checks.
   */
  private recomputePriceDiscrepancies(
    initialResult: { discrepancies: any[]; pairings: any[] },
    po: any,
    dns: any[],
    invs: any[],
  ): { discrepancies: any[]; pairings: any[] } {
    // Keep all discrepancies except totalAmount (which needs recalculation after DN price backfill).
    // lineItemPrice discrepancies are preserved: backfill only touches items that had NO price,
    // so existing price mismatch discrepancies remain valid.
    const nonTotalDiscrepancies = initialResult.discrepancies.filter(
      (d) => d.field !== 'totalAmount',
    );

    // Recalculate total amount discrepancy with updated DN totals
    const poAmount = po?.totalAmount ? Number(po.totalAmount) : null;
    const dnAmount = dns.length > 0
      ? dns.reduce((sum: number, dn: any) => sum + (dn?.totalAmount ? Number(dn.totalAmount) : 0), 0) || null
      : null;
    const invAmount = invs.length > 0
      ? invs.reduce((sum: number, inv: any) => sum + (inv?.totalAmount ? Number(inv.totalAmount) : 0), 0) || null
      : null;

    const amounts = [poAmount, dnAmount, invAmount].filter((a): a is number => a !== null);
    if (amounts.length >= 2) {
      const maxAmt = Math.max(...amounts);
      const minAmt = Math.min(...amounts);
      if (maxAmt > 0) {
        const diffPct = ((maxAmt - minAmt) / maxAmt) * 100;
        if (diffPct > 1) {
          nonTotalDiscrepancies.push({
            field: 'totalAmount',
            description: `total_amount_diff:${diffPct.toFixed(1)}%`,
            poValue: poAmount?.toFixed(2) ?? null,
            dnValue: dnAmount?.toFixed(2) ?? null,
            invValue: invAmount?.toFixed(2) ?? null,
            severity: diffPct > 10 ? 'CRITICAL' : 'WARNING',
          });
        }
      }
    }

    return { discrepancies: nonTotalDiscrepancies, pairings: initialResult.pairings };
  }

  /** Auto-fill missing prices on DN line items from matched PO line items. Returns true if any prices were updated. */
  async backfillPricesFromPO(matchId: string, po: any, dns: any[], pairings: any[]): Promise<boolean> {
    const updatedIds = new Set<string>();
    const batchUpdates: { id: string; unitPrice: number; totalPrice: number }[] = [];

    for (const pairing of pairings) {
      if (!pairing?.po || !pairing?.dn) continue;

      const poLineItem = this.findPoLineItem(pairing.po, po.lineItems);
      if (!poLineItem?.unitPrice) continue;

      // Find the exact DN line item across all DNs - match ONE item only
      let matched = false;
      for (const dn of dns) {
        if (matched) break;

        const dnLineItem = this.findDnLineItem(pairing.dn, dn.lineItems, updatedIds);
        if (!dnLineItem) continue;
        if (dnLineItem.unitPrice != null || dnLineItem.priceSource === 'manual') continue;
        if (updatedIds.has(dnLineItem.id)) continue;

        const unitPrice = Number(poLineItem.unitPrice);
        const quantity = Number(dnLineItem.quantity) || 0;
        const totalPrice = Math.round(unitPrice * quantity * 100) / 100;

        batchUpdates.push({ id: dnLineItem.id, unitPrice, totalPrice });
        // Update in-memory so recomputePriceDiscrepancies sees fresh data
        dnLineItem.unitPrice = unitPrice;
        dnLineItem.totalPrice = totalPrice;
        dnLineItem.priceSource = 'po_matched';

        updatedIds.add(dnLineItem.id);
        matched = true;
        this.logger.log(`Backfilled price ${unitPrice} from PO "${poLineItem.description?.slice(0, 30)}" to DN "${dnLineItem.description?.slice(0, 30)}" (match ${matchId})`);
      }
    }

    if (batchUpdates.length > 0) {
      // Execute all line item updates in a single transaction
      await this.prisma.$transaction(
        batchUpdates.map((u) =>
          this.prisma.lineItem.update({
            where: { id: u.id },
            data: { unitPrice: u.unitPrice, totalPrice: u.totalPrice, priceSource: 'po_matched' },
          }),
        ),
      );
      await this.recomputeDnTotals(dns);
      return true;
    }
    return false;
  }

  /** Recompute DN total_amount from the sum of its line item totalPrices */
  private async recomputeDnTotals(dns: any[]) {
    const dnIds = dns.map((dn) => dn.id);
    if (dnIds.length === 0) return;

    // Fetch all line items for all DNs in a single query
    const allLineItems = await this.prisma.lineItem.findMany({
      where: { deliveryNoteId: { in: dnIds } },
      select: { deliveryNoteId: true, totalPrice: true },
    });

    // Group by DN and compute totals
    const totalsByDn = new Map<string, number>();
    for (const li of allLineItems) {
      if (!li.deliveryNoteId) continue;
      const current = totalsByDn.get(li.deliveryNoteId) || 0;
      totalsByDn.set(li.deliveryNoteId, current + (Number(li.totalPrice) || 0));
    }

    // Batch update all DNs with new totals
    const updateOps: any[] = [];
    for (const [dnId, total] of totalsByDn) {
      if (total > 0) {
        const roundedTotal = Math.round(total * 100) / 100;
        updateOps.push(
          this.prisma.deliveryNote.update({
            where: { id: dnId },
            data: { totalAmount: roundedTotal },
          }),
        );
        // Update in-memory for price discrepancy recomputation
        const dn = dns.find((d) => d.id === dnId);
        if (dn) dn.totalAmount = roundedTotal;
        this.logger.log(`Updated DN ${dnId} totalAmount to ${total.toFixed(2)}`);
      }
    }

    if (updateOps.length > 0) {
      await this.prisma.$transaction(updateOps);
    }
  }

  /** Find PO line item by ID → catalog → normalized description → keyword overlap */
  private findPoLineItem(pairingPo: PairingRef, poLineItems: LineItem[]): LineItem | null {
    if (pairingPo.id) {
      const byId = poLineItems.find((pli) => pli.id === pairingPo.id);
      if (byId) return byId;
    }
    if (pairingPo.catalogNumber) {
      const byCat = poLineItems.find((pli) => pli.catalogNumber === pairingPo.catalogNumber);
      if (byCat) return byCat;
    }
    const normDesc = this.normalizeDesc(pairingPo.description);
    if (normDesc) {
      const byDesc = poLineItems.find((pli) => this.normalizeDesc(pli.description) === normDesc);
      if (byDesc) return byDesc;
    }
    if (pairingPo.description) {
      const byFuzzy = poLineItems.find((pli) => this.descKeywordsMatch(pairingPo.description!, pli.description ?? null));
      if (byFuzzy) return byFuzzy;
    }
    return null;
  }

  /** Find DN line item by ID → catalog → normalized description */
  private findDnLineItem(pairingDn: PairingRef, dnLineItems: LineItem[], usedIds: Set<string>): LineItem | null {
    if (pairingDn.id) {
      const byId = dnLineItems.find((li) => li.id === pairingDn.id);
      if (byId) return byId;
    }
    if (pairingDn.catalogNumber) {
      const byCat = dnLineItems.find((li) => li.catalogNumber === pairingDn.catalogNumber && !usedIds.has(li.id));
      if (byCat) return byCat;
    }
    const normDesc = this.normalizeDesc(pairingDn.description);
    if (normDesc) {
      const byDesc = dnLineItems.find((li) => this.normalizeDesc(li.description) === normDesc && !usedIds.has(li.id));
      if (byDesc) return byDesc;
    }
    return null;
  }

  /** Normalize description for comparison: collapse whitespace, trim */
  private normalizeDesc(desc: string | null | undefined): string {
    if (!desc) return '';
    return desc.replace(/\s+/g, ' ').trim();
  }

  /** Check if two descriptions share enough significant keywords */
  private descKeywordsMatch(a: string | null, b: string | null): boolean {
    if (!a || !b) return false;
    const kw = (s: string) => s.replace(/[()"/\-,.:;!?\n]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    const kwA = kw(a);
    const kwB = kw(b);
    if (kwA.length === 0 || kwB.length === 0) return false;
    const common = kwA.filter(w => kwB.some(w2 => w === w2 || w.includes(w2) || w2.includes(w)));
    return common.length / Math.max(kwA.length, kwB.length) >= 0.4;
  }
}
