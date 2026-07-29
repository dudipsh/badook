import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SemanticMatchingService, LineItemRef } from './semantic-matching.service';
import { LineItemPairing } from './matching.types';
import { toPairingItem, normalizeDesc } from './line-item-match-utils';

@Injectable()
export class AiMatcherService {
  private readonly logger = new Logger(AiMatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly semanticMatching: SemanticMatchingService,
  ) {}

  async getOcrProvider(companyId: string): Promise<'OPENAI' | 'GEMINI'> {
    const scanSettings = await this.prisma.companyScanSettings.findUnique({
      where: { companyId },
    });
    const provider = scanSettings?.ocrProvider ?? 'GEMINI';
    if (provider === 'OPENAI') return 'OPENAI';
    // Fine-tuned Gemini was trained for vision OCR, not text matching — fall back to base Gemini.
    return 'GEMINI';
  }

  async matchByAI(
    unmatchedPo: { item: any; i: number }[],
    unmatchedDn: { item: any; i: number }[],
    unmatchedInv: { item: any; i: number }[],
    companyId: string,
    feedbackRecords: { descriptionA: string; descriptionB: string }[],
    itemMap: Map<string, { po?: any; dn?: any; inv?: any }>,
    pairings: LineItemPairing[],
    matchedPo: Set<number>, matchedDn: Set<number>, matchedInv: Set<number>,
  ) {
    const provider = await this.getOcrProvider(companyId);

    const toRef = (items: { item: any; i: number }[]): LineItemRef[] =>
      items.map(({ item }, idx) => ({
        index: idx,
        description: normalizeDesc(item.description),
        catalogNumber: item.catalogNumber?.trim() || null,
        quantity: Number(item.quantity) || 0,
        unitPrice: item.unitPrice != null ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice != null ? Number(item.totalPrice) : null,
      }));

    const aiResult = await this.semanticMatching.matchLineItems(
      toRef(unmatchedPo), toRef(unmatchedDn), toRef(unmatchedInv),
      provider, feedbackRecords.slice(0, 20), companyId,
    );

    for (const match of aiResult.matches) {
      const entry: { po?: any; dn?: any; inv?: any } = {};
      const pairing: LineItemPairing = { matchSource: 'ai' };
      const parts: string[] = [];

      if (match.po !== null && match.po < unmatchedPo.length) {
        entry.po = unmatchedPo[match.po].item;
        parts.push(entry.po.description || `po-${match.po}`);
        matchedPo.add(unmatchedPo[match.po].i);
        pairing.po = toPairingItem(entry.po, unmatchedPo[match.po].i);
      }
      if (match.dn !== null && match.dn < unmatchedDn.length) {
        entry.dn = unmatchedDn[match.dn].item;
        if (parts.length === 0) parts.push(entry.dn.description || `dn-${match.dn}`);
        matchedDn.add(unmatchedDn[match.dn].i);
        pairing.dn = toPairingItem(entry.dn, unmatchedDn[match.dn].i);
      }
      if (match.inv !== null && match.inv < unmatchedInv.length) {
        entry.inv = unmatchedInv[match.inv].item;
        if (parts.length === 0) parts.push(entry.inv.description || `inv-${match.inv}`);
        matchedInv.add(unmatchedInv[match.inv].i);
        pairing.inv = toPairingItem(entry.inv, unmatchedInv[match.inv].i);
      }

      itemMap.set(`ai:${pairings.length}:${parts[0] || 'unknown'}`, entry);
      pairings.push(pairing);
    }

    this.logger.log(`AI matched ${aiResult.matches.length} item groups from ${unmatchedPo.length}+${unmatchedDn.length}+${unmatchedInv.length} unmatched`);
  }

  async matchByAISecondRound(
    unmatchedPo: { item: any; i: number }[],
    unmatchedDn: { item: any; i: number }[],
    unmatchedInv: { item: any; i: number }[],
    companyId: string,
    feedbackRecords: { descriptionA: string; descriptionB: string }[],
    alreadyMatched: { po?: string; dn?: string; inv?: string }[],
    itemMap: Map<string, { po?: any; dn?: any; inv?: any }>,
    pairings: LineItemPairing[],
    matchedPo: Set<number>, matchedDn: Set<number>, matchedInv: Set<number>,
  ) {
    const provider = await this.getOcrProvider(companyId);

    const toRef = (items: { item: any; i: number }[]): LineItemRef[] =>
      items.map(({ item }, idx) => ({
        index: idx,
        description: normalizeDesc(item.description),
        catalogNumber: item.catalogNumber?.trim() || null,
        quantity: Number(item.quantity) || 0,
        unitPrice: item.unitPrice != null ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice != null ? Number(item.totalPrice) : null,
      }));

    const aiResult = await this.semanticMatching.matchLineItemsSecondRound(
      toRef(unmatchedPo), toRef(unmatchedDn), toRef(unmatchedInv),
      provider, alreadyMatched, feedbackRecords.slice(0, 20), companyId,
    );

    for (const match of aiResult.matches) {
      const entry: { po?: any; dn?: any; inv?: any } = {};
      const pairing: LineItemPairing = { matchSource: 'ai_second_round' };
      const parts: string[] = [];

      if (match.po !== null && match.po < unmatchedPo.length && !matchedPo.has(unmatchedPo[match.po].i)) {
        entry.po = unmatchedPo[match.po].item;
        parts.push(entry.po.description || `po-${match.po}`);
        matchedPo.add(unmatchedPo[match.po].i);
        pairing.po = toPairingItem(entry.po, unmatchedPo[match.po].i);
      }
      if (match.dn !== null && match.dn < unmatchedDn.length && !matchedDn.has(unmatchedDn[match.dn].i)) {
        entry.dn = unmatchedDn[match.dn].item;
        if (parts.length === 0) parts.push(entry.dn.description || `dn-${match.dn}`);
        matchedDn.add(unmatchedDn[match.dn].i);
        pairing.dn = toPairingItem(entry.dn, unmatchedDn[match.dn].i);
      }
      if (match.inv !== null && match.inv < unmatchedInv.length && !matchedInv.has(unmatchedInv[match.inv].i)) {
        entry.inv = unmatchedInv[match.inv].item;
        if (parts.length === 0) parts.push(entry.inv.description || `inv-${match.inv}`);
        matchedInv.add(unmatchedInv[match.inv].i);
        pairing.inv = toPairingItem(entry.inv, unmatchedInv[match.inv].i);
      }

      // Only add if we got at least 2 document types matched
      const docCount = [entry.po, entry.dn, entry.inv].filter(Boolean).length;
      if (docCount >= 2) {
        // Remove old orphan pairings for these items
        for (let pi = pairings.length - 1; pi >= 0; pi--) {
          const p = pairings[pi];
          const pDocs = [p.po, p.dn, p.inv].filter(Boolean).length;
          if (pDocs > 1) continue; // Skip multi-doc pairings
          if (p.po && entry.po && p.po.index === pairing.po?.index) { pairings.splice(pi, 1); continue; }
          if (p.dn && entry.dn && p.dn.index === pairing.dn?.index) { pairings.splice(pi, 1); continue; }
          if (p.inv && entry.inv && p.inv.index === pairing.inv?.index) { pairings.splice(pi, 1); continue; }
        }

        itemMap.set(`ai2:${pairings.length}:${parts[0] || 'unknown'}`, entry);
        pairings.push(pairing);
      }
    }

    this.logger.log(`AI second-round matched ${aiResult.matches.length} item groups from ${unmatchedPo.length}+${unmatchedDn.length}+${unmatchedInv.length} orphans`);
  }

  matchByDescription(
    unmatchedPo: { item: any; i: number }[],
    unmatchedDn: { item: any; i: number }[],
    unmatchedInv: { item: any; i: number }[],
    itemMap: Map<string, { po?: any; dn?: any; inv?: any }>,
    pairings: LineItemPairing[],
    matchedPo: Set<number>, matchedDn: Set<number>, matchedInv: Set<number>,
  ) {
    const descGroups = new Map<string, { mapKey: string; pairingIdx: number }[]>();
    const getDescKey = (item: any) => normalizeDesc(item.description).toLowerCase();

    const addItems = (items: { item: any; i: number }[], docType: 'po' | 'dn' | 'inv', matched: Set<number>) => {
      for (const { item, i } of items) {
        if (matched.has(i)) continue;
        const key = getDescKey(item);
        if (!key) continue;

        const entries = descGroups.get(key) || [];

        // Find an existing entry that doesn't have this docType filled yet
        let bestIdx = -1;
        const itemQty = Number(item.quantity) || 0;

        for (let ei = 0; ei < entries.length; ei++) {
          const mapEntry = itemMap.get(entries[ei].mapKey);
          if (!mapEntry || mapEntry[docType]) continue;
          if (bestIdx < 0) bestIdx = ei;
          // Prefer entry where existing item quantity matches
          const existing = mapEntry.po || mapEntry.dn || mapEntry.inv;
          if (existing && Math.abs((Number(existing.quantity) || 0) - itemQty) < 0.01) {
            bestIdx = ei;
            break;
          }
        }

        if (bestIdx >= 0) {
          const entry = entries[bestIdx];
          itemMap.get(entry.mapKey)![docType] = item;
          pairings[entry.pairingIdx][docType] = toPairingItem(item, i);
        } else {
          const mapKey = `desc:${entries.length}:${key}`;
          itemMap.set(mapKey, { [docType]: item });
          const pairing: LineItemPairing = { matchSource: 'description', [docType]: toPairingItem(item, i) } as LineItemPairing;
          pairings.push(pairing);
          entries.push({ mapKey, pairingIdx: pairings.length - 1 });
          descGroups.set(key, entries);
        }
        matched.add(i);
      }
    };

    addItems(unmatchedPo, 'po', matchedPo);
    addItems(unmatchedDn, 'dn', matchedDn);
    addItems(unmatchedInv, 'inv', matchedInv);
  }
}
