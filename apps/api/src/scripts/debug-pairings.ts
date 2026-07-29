/**
 * Debug: dump match pairings to understand cross-match DN sharing
 * Uses Prisma directly to avoid AppModule initialization issues
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  const matches = await prisma.threeWayMatch.findMany({
    include: {
      purchaseOrder: { select: { id: true, poNumber: true } },
      deliveryNotes: {
        select: { id: true, noteNumber: true, lineItems: { select: { id: true, description: true, quantity: true, sortOrder: true } } },
      },
      invoices: {
        select: { id: true, invoiceNumber: true, lineItems: { select: { id: true, description: true, quantity: true, sortOrder: true } } },
      },
    },
  });

  for (const m of matches) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Match: ${m.id}`);
    console.log(`  PO: ${m.purchaseOrder?.poNumber || 'none'} (${m.purchaseOrderId || 'null'})`);
    console.log(`  DNs: ${m.deliveryNotes.map(d => `${d.noteNumber || d.id.slice(0,8)} (${d.lineItems.length} items)`).join(', ')}`);
    console.log(`  Invoices: ${m.invoices.map(i => `${i.invoiceNumber || i.id.slice(0,8)} (${i.lineItems.length} items)`).join(', ')}`);

    // Show DN line item IDs
    console.log(`\n  DN Line Items:`);
    for (const dn of m.deliveryNotes) {
      for (const li of dn.lineItems) {
        console.log(`    DN ${dn.noteNumber || dn.id.slice(0,8)} | sort=${li.sortOrder} | qty=${li.quantity} | id=${li.id} | desc="${(li.description || '').slice(0,50)}"`);
      }
    }

    const pairings = (m.lineItemPairings as any[]) || [];
    console.log(`\n  Pairings (${pairings.length}):`);
    for (let i = 0; i < pairings.length; i++) {
      const p = pairings[i];
      const poInfo = p?.po ? `PO[${p.po.index}] id=${(p.po.id || 'none').slice(0,20)} "${(p.po.description || '').slice(0,30)}" qty=${p.po.quantity}` : 'no PO';
      const dnInfo = p?.dn ? `DN[${p.dn.index}] id=${(p.dn.id || 'none').slice(0,20)} "${(p.dn.description || '').slice(0,30)}" qty=${p.dn.quantity}` : 'no DN';
      const invInfo = p?.inv ? `INV[${p.inv.index}] id=${(p.inv.id || 'none').slice(0,20)} qty=${p.inv.quantity}` : 'no INV';
      console.log(`    [${i}] ${p?.matchSource || '?'} | ${poInfo} | ${dnInfo} | ${invInfo}`);
    }

    // Check which DN line IDs are in pairings
    const claimedDnIds = new Set<string>();
    for (const p of pairings) {
      if (p?.dn?.id) claimedDnIds.add(p.dn.id);
    }
    const allDnLineIds = m.deliveryNotes.flatMap(d => d.lineItems.map(li => li.id));
    const unclaimed = allDnLineIds.filter(id => !claimedDnIds.has(id));
    console.log(`\n  Claimed DN line IDs: ${claimedDnIds.size}/${allDnLineIds.length}`);
    if (unclaimed.length > 0) {
      console.log(`  UNCLAIMED DN line IDs: ${unclaimed.map(id => id.slice(0,20)).join(', ')}`);
    }

    // Check for DN IDs in pairings that don't match any actual DN line item
    const actualDnLineIds = new Set(allDnLineIds);
    const phantomIds = [...claimedDnIds].filter(id => !actualDnLineIds.has(id));
    if (phantomIds.length > 0) {
      console.log(`  ⚠️ PHANTOM pairing DN IDs (not found in actual DNs): ${phantomIds.map(id => id.slice(0,20)).join(', ')}`);
    }
  }

  // Cross-match analysis
  console.log(`\n${'='.repeat(80)}`);
  console.log('CROSS-MATCH ANALYSIS:');
  const dnIdToMatches = new Map<string, string[]>();
  for (const m of matches) {
    for (const dn of m.deliveryNotes) {
      if (!dnIdToMatches.has(dn.id)) dnIdToMatches.set(dn.id, []);
      dnIdToMatches.get(dn.id)!.push(m.purchaseOrder?.poNumber || m.id.slice(0,8));
    }
  }
  for (const [dnId, matchNames] of dnIdToMatches) {
    if (matchNames.length > 1) {
      const dn = matches.flatMap(m => m.deliveryNotes).find(d => d.id === dnId);
      console.log(`  SHARED DN ${dn?.noteNumber || dnId.slice(0,8)}: used by ${matchNames.join(', ')}`);
    }
  }

  // DN line item sharing across match pairings
  const dnLineToMatches = new Map<string, string[]>();
  for (const m of matches) {
    const pairings = (m.lineItemPairings as any[]) || [];
    for (const p of pairings) {
      if (p?.dn?.id) {
        if (!dnLineToMatches.has(p.dn.id)) dnLineToMatches.set(p.dn.id, []);
        dnLineToMatches.get(p.dn.id)!.push(m.purchaseOrder?.poNumber || m.id.slice(0,8));
      }
    }
  }
  console.log('\nDN LINE ITEM cross-claims:');
  for (const [dnLineId, matchNames] of dnLineToMatches) {
    if (matchNames.length > 1) {
      console.log(`  ⚠️ DN LINE ${dnLineId.slice(0,20)} claimed by: ${matchNames.join(', ')}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
