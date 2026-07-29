import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  LineItemPairing,
  MatchingLineItem,
} from './matching.types';
import { extractKeywords, fuzzyHebrewWordMatch } from './line-item-match-utils';

/** Write detailed matching debug dump to a txt file */
export const writeMatchingDebugDump = (
  poItems: MatchingLineItem[],
  dnItems: MatchingLineItem[],
  invItems: MatchingLineItem[],
  pairings: LineItemPairing[],
  matchedPo: Set<number>,
  matchedDn: Set<number>,
  matchedInv: Set<number>,
  logger: Logger,
) => {
  try {
    const lines: string[] = [];
    const ts = new Date().toISOString().replace(/[:.]/g, '-');

    lines.push(`=== MATCHING DEBUG DUMP — ${new Date().toISOString()} ===`);
    lines.push('');

    // -- Input items --
    const fmtItem = (item: MatchingLineItem, idx: number) => {
      const desc = (item.description || '').trim();
      const cat = item.catalogNumber || '-';
      const qty = Number(item.quantity) || 0;
      const unit = item.unit || '-';
      const up = Number(item.unitPrice) || 0;
      const tp = Number(item.totalPrice) || 0;
      const kw = [...extractKeywords(desc)].join(', ');
      return `  [${idx}] desc="${desc}" | cat=${cat} | qty=${qty} | unit=${unit} | unitPrice=${up} | totalPrice=${tp}\n       keywords=[${kw}]`;
    };

    lines.push(`── PO ITEMS (${poItems.length}) ──`);
    poItems.forEach((item, i) => lines.push(fmtItem(item, i)));
    lines.push('');

    lines.push(`── DN ITEMS (${dnItems.length}) ──`);
    dnItems.forEach((item, i) => lines.push(fmtItem(item, i)));
    lines.push('');

    lines.push(`── INV ITEMS (${invItems.length}) ──`);
    invItems.forEach((item, i) => lines.push(fmtItem(item, i)));
    lines.push('');

    // -- Matched pairings --
    lines.push(`── MATCHED PAIRINGS (${pairings.filter(p => [p.po, p.dn, p.inv].filter(Boolean).length >= 2).length}) ──`);
    for (const p of pairings) {
      const parts = [p.po, p.dn, p.inv].filter(Boolean);
      if (parts.length < 2) continue;
      const poDesc = p.po ? `PO[${p.po.index}]="${p.po.description?.slice(0, 50)}" qty=${p.po.quantity}` : '';
      const dnDesc = p.dn ? `DN[${p.dn.index}]="${p.dn.description?.slice(0, 50)}" qty=${p.dn.quantity}` : '';
      const invDesc = p.inv ? `INV[${p.inv.index}]="${p.inv.description?.slice(0, 50)}" qty=${p.inv.quantity}` : '';
      lines.push(`  [${p.matchSource}] ${[poDesc, dnDesc, invDesc].filter(Boolean).join(' ↔ ')}`);
    }
    lines.push('');

    // -- Orphans --
    const orphanPo = poItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedPo.has(i));
    const orphanDn = dnItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedDn.has(i));
    const orphanInv = invItems.map((item, i) => ({ item, i })).filter(({ i }) => !matchedInv.has(i));

    lines.push(`── UNMATCHED ORPHANS ──`);
    lines.push(`  PO orphans (${orphanPo.length}):`);
    for (const { item, i } of orphanPo) lines.push(fmtItem(item, i));
    lines.push(`  DN orphans (${orphanDn.length}):`);
    for (const { item, i } of orphanDn) lines.push(fmtItem(item, i));
    lines.push(`  INV orphans (${orphanInv.length}):`);
    for (const { item, i } of orphanInv) lines.push(fmtItem(item, i));
    lines.push('');

    // -- Cross-comparison of orphans --
    if (orphanPo.length > 0 && orphanDn.length > 0) {
      lines.push(`── ORPHAN CROSS-COMPARISON (PO ↔ DN) ──`);
      for (const po of orphanPo) {
        const poDesc = (po.item.description || '').trim();
        const poKw = [...extractKeywords(poDesc)];
        const poQty = Number(po.item.quantity) || 0;
        const poUP = Number(po.item.unitPrice) || 0;
        const poTotal = Number(po.item.totalPrice) || (poUP * poQty);

        lines.push(`  PO[${po.i}] "${poDesc}" qty=${poQty} up=${poUP} total=${poTotal}`);
        lines.push(`    keywords: [${poKw.join(', ')}]`);

        for (const dn of orphanDn) {
          const dnDesc = (dn.item.description || '').trim();
          const dnKw = [...extractKeywords(dnDesc)];
          const dnQty = Number(dn.item.quantity) || 0;
          const dnUP = Number(dn.item.unitPrice) || 0;
          const dnTotal = Number(dn.item.totalPrice) || (dnUP * dnQty);

          // Keyword comparison
          let kwShared = 0;
          const matchedWords: string[] = [];
          for (const pw of poKw) {
            for (const dw of dnKw) {
              if (pw === dw || fuzzyHebrewWordMatch(pw, dw)) {
                kwShared++;
                matchedWords.push(`${pw}≈${dw}`);
                break;
              }
            }
          }

          const qtyMatch = poQty === dnQty ? 'EXACT' : (poQty > 0 && dnQty > 0 && Math.abs(poQty - dnQty) / Math.max(poQty, dnQty) <= 0.15 ? 'CLOSE' : 'NO');
          const priceMatch = poUP > 0 && dnUP > 0 && Math.abs(poUP - dnUP) / Math.max(poUP, dnUP) <= 0.15 ? 'CLOSE' : 'NO';
          const totalMatch = poTotal > 0 && dnTotal > 0 && Math.abs(poTotal - dnTotal) / Math.max(poTotal, dnTotal) <= 0.2 ? 'CLOSE' : 'NO';

          lines.push(`    vs DN[${dn.i}] "${dnDesc}" qty=${dnQty} up=${dnUP} total=${dnTotal}`);
          lines.push(`      dn_keywords: [${dnKw.join(', ')}]`);
          lines.push(`      shared=${kwShared}/${Math.max(poKw.length, dnKw.length)} words=[${matchedWords.join(', ')}] | qty=${qtyMatch} | price=${priceMatch} | total=${totalMatch}`);
        }
        lines.push('');
      }
    }

    // Write to file
    const debugDir = path.resolve(process.cwd(), 'debug-logs');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    const filePath = path.join(debugDir, `matching-debug-${ts}.txt`);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    logger.log(`[DEBUG] Matching debug dump written to: ${filePath}`);
  } catch (err) {
    logger.warn(`[DEBUG] Failed to write matching debug dump: ${err}`);
  }
};
