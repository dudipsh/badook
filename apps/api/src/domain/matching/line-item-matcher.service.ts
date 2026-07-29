import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AiMatcherService } from './ai-matcher.service';
import {
  LineItemPairing,
  MatchItemsResult,
  MatchingLineItem,
  ItemMapEntry,
} from './matching.types';
import { matchByQuantityAndKeywords } from './fuzzy-qty-matcher';
import { mergePOOrphansWithCatalogGroups } from './catalog-group-merger';
import { relaxedOrphanMatching } from './relaxed-matcher';
import { matchByFeedback } from './feedback-matcher';
import { matchByCatalog } from './catalog-matcher';
import { validatePairings } from './pairing-validator';
import {
  addOrphans,
  linkOrphanDnsToPo,
  linkOrphanDnsToPoInvPairs,
  pairSettlementInvoiceLines,
} from './orphan-linker';
import { writeMatchingDebugDump } from './matching-debug-dump';

@Injectable()
export class LineItemMatcherService {
  private readonly logger = new Logger(LineItemMatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiMatcher: AiMatcherService,
  ) { }

  /**
   * Multi-phase line item matching:
   * Phase 0: Feedback-based match (from user corrections)
   * Phase 1: Exact catalog number match
   * Phase 2: AI semantic matching
   * Fallback: Description-based matching
   */
  async matchItems(
    poItems: MatchingLineItem[],
    dnItems: MatchingLineItem[],
    invItems: MatchingLineItem[],
    companyId: string,
  ): Promise<MatchItemsResult> {
    const itemMap = new Map<string, ItemMapEntry>();
    const pairings: LineItemPairing[] = [];
    const matchedPo = new Set<number>();
    const matchedDn = new Set<number>();
    const matchedInv = new Set<number>();

    const feedbackRecords = await this.prisma.itemMatchFeedback.findMany({
      where: { companyId, feedbackType: { not: 'REJECTED' } },
      orderBy: { createdAt: 'desc' },
      select: { descriptionA: true, descriptionB: true },
    });

    matchByFeedback(
      poItems, dnItems, invItems, feedbackRecords,
      itemMap, pairings, matchedPo, matchedDn, matchedInv,
      this.logger,
    );
    matchByCatalog(
      poItems, dnItems, invItems,
      itemMap, pairings, matchedPo, matchedDn, matchedInv,
    );

    // Phase 2.5: Fuzzy matching by quantity similarity + keyword overlap (before AI)
    matchByQuantityAndKeywords(
      poItems, dnItems, invItems,
      itemMap, pairings, matchedPo, matchedDn, matchedInv,
      this.logger,
    );

    const unmatchedPo = poItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedPo.has(i));
    const unmatchedDn = dnItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedDn.has(i));
    const unmatchedInv = invItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedInv.has(i));

    const hasUnmatched = unmatchedPo.length > 0 || unmatchedDn.length > 0 || unmatchedInv.length > 0;

    if (hasUnmatched) {
      try {
        await this.aiMatcher.matchByAI(
          unmatchedPo, unmatchedDn, unmatchedInv, companyId, feedbackRecords,
          itemMap, pairings, matchedPo, matchedDn, matchedInv,
        );
      } catch (err) {
        this.logger.warn(`AI matching failed, falling back to description matching: ${err}`);
        this.aiMatcher.matchByDescription(
          unmatchedPo, unmatchedDn, unmatchedInv,
          itemMap, pairings, matchedPo, matchedDn, matchedInv,
        );
      }

      // Add orphans first, so the merge step can find PO-only entries in itemMap
      addOrphans(unmatchedPo, unmatchedDn, unmatchedInv, itemMap, pairings, matchedPo, matchedDn, matchedInv);

      // Merge step: PO orphans with DN+INV catalog groups by matching quantity/keywords
      mergePOOrphansWithCatalogGroups(itemMap, pairings, matchedPo, this.logger);
    }

    // Post-validation: reject pairings with zero keyword overlap (and free rejected items for re-matching)
    validatePairings(pairings, matchedPo, matchedDn, matchedInv, this.logger);

    // Second-round matching: retry orphaned items with more context (process of elimination)
    const remainingPo = hasUnmatched
      ? poItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedPo.has(i))
      : [];
    const remainingDn = hasUnmatched
      ? dnItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedDn.has(i))
      : [];
    const remainingInv = hasUnmatched
      ? invItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedInv.has(i))
      : [];

    if (remainingPo.length > 0 && (remainingDn.length > 0 || remainingInv.length > 0)) {
      const alreadyMatched = pairings
        .filter(p => p.po && (p.dn || p.inv))
        .map(p => ({ po: p.po?.description, dn: p.dn?.description, inv: p.inv?.description }));

      try {
        await this.aiMatcher.matchByAISecondRound(
          remainingPo, remainingDn, remainingInv,
          companyId, feedbackRecords, alreadyMatched,
          itemMap, pairings, matchedPo, matchedDn, matchedInv,
        );
        this.logger.log(`Second-round: ${remainingPo.length} PO + ${remainingDn.length} DN + ${remainingInv.length} INV orphans retried`);
      } catch (err) {
        this.logger.warn(`Second-round AI matching failed: ${err}`);
      }

      // Validate second-round matches (reject zero keyword overlap, free rejected items)
      validatePairings(pairings, matchedPo, matchedDn, matchedInv, this.logger);
    }

    // Final relaxed pass: match remaining orphans by quantity/price signals
    relaxedOrphanMatching(
      poItems, dnItems, invItems,
      itemMap, pairings, matchedPo, matchedDn, matchedInv,
      this.logger,
    );

    // Settlement/consolidated invoice handling: pair orphan settlement invoice lines
    // with the first PO item (they cover the entire order, not individual items)
    pairSettlementInvoiceLines(
      poItems, invItems,
      itemMap, pairings, matchedPo, matchedInv,
      this.logger,
    );

    // Link orphan DN pairings to matching PO items (partial deliveries:
    // multiple DNs deliver parts of the same PO line item)
    linkOrphanDnsToPo(pairings, poItems, itemMap, this.logger);

    // Link orphan DNs to PO+INV pairings that have no DN yet
    // (e.g. PO was catalog-matched to INV but DN has different catalog number)
    linkOrphanDnsToPoInvPairs(pairings, matchedDn, this.logger);

    // Write debug dump to file (only when DEBUG_MATCHING=true)
    if (process.env.DEBUG_MATCHING === 'true') {
      writeMatchingDebugDump(
        poItems, dnItems, invItems,
        pairings, matchedPo, matchedDn, matchedInv,
        this.logger,
      );
    }

    return { itemMap, pairings };
  }
}
