/**
 * Debug: simulate getVendorLineItems to trace received qty computation
 */
import { PrismaClient } from '@prisma/client';
import { buildLineItem } from '../domain/projects/build-line-item';
import { normalize } from '../domain/projects/resolve-received';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  // Find all POs
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
  });

  const poIds = purchaseOrders.map(po => po.id);
  const matches = await prisma.threeWayMatch.findMany({
    where: { purchaseOrderId: { in: poIds } },
    include: {
      deliveryNotes: {
        select: {
          id: true, noteNumber: true, deliveryDate: true,
          originalFileUrl: true, originalFileName: true,
          lineItems: true,
        },
      },
      invoices: {
        select: {
          id: true, invoiceNumber: true, originalFileUrl: true,
          lineItems: true,
        },
      },
    },
  });

  const matchByPoId = new Map(matches.map(m => [m.purchaseOrderId, m]));

  // Build cross-match DN line exclusion sets (same as vendor-line-items.service.ts)
  const dnLineClaimsByMatchId = new Map<string, Set<string>>();
  for (const m of matches) {
    const claimed = new Set<string>();
    for (const p of (m.lineItemPairings as any[]) || []) {
      if (p?.dn?.id) claimed.add(p.dn.id);
    }
    dnLineClaimsByMatchId.set(m.id, claimed);
    console.log(`Match ${m.id.slice(0,8)} (PO ${purchaseOrders.find(po => po.id === m.purchaseOrderId)?.poNumber}): claims ${claimed.size} DN line IDs`);
  }

  for (const po of purchaseOrders) {
    const match = matchByPoId.get(po.id);
    const pairings = (match?.lineItemPairings as any[]) || [];

    // Build crossExcluded
    const crossExcluded = new Set<string>();
    if (match) {
      for (const [matchId, claimed] of dnLineClaimsByMatchId) {
        if (matchId !== match.id) {
          for (const id of claimed) crossExcluded.add(id);
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`PO: ${po.poNumber} (${po.id.slice(0,12)})`);
    console.log(`  Match: ${match?.id?.slice(0,12) || 'none'}`);
    console.log(`  crossExcluded size: ${crossExcluded.size}`);
    console.log(`  crossExcluded IDs: ${[...crossExcluded].map(id => id.slice(0,15)).join(', ')}`);

    for (const lineItem of po.lineItems) {
      console.log(`\n  --- Line: sort=${lineItem.sortOrder} "${(lineItem.description || '').slice(0,40)}" qty=${lineItem.quantity}`);

      // Find pairing (same logic as buildLineItem)
      const pairing =
        pairings.find((p: any) => p?.po?.id && p.po.id === lineItem.id && p?.dn) ||
        pairings.find((p: any) => p?.po?.id && p.po.id === lineItem.id) ||
        pairings.find((p: any) => p?.po?.index === lineItem.sortOrder && p?.dn) ||
        pairings.find((p: any) => p?.po?.index === lineItem.sortOrder);

      console.log(`  Pairing: ${pairing ? `dn.id=${pairing.dn?.id?.slice(0,15) || 'none'} src=${pairing.matchSource}` : 'none'}`);

      const item = buildLineItem(po, lineItem, match, pairings, undefined, crossExcluded.size > 0 ? crossExcluded : undefined);
      console.log(`  → receivedQty: ${item.receivedQty}`);
      console.log(`  → orderedQty: ${item.orderedQty}`);
      console.log(`  → deliveryHistory (${item.deliveryHistory.length}): ${item.deliveryHistory.map((h: any) => `${h.noteNumber}:${h.quantity}`).join(', ')}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
