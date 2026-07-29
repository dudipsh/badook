import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, companyId: true },
  });
  console.log(`Projects (${projects.length}):`);
  for (const p of projects) console.log(`  ${p.id} | ${p.name}`);

  for (const project of projects) {
    console.log(`\n==================== PROJECT ${project.id} ====================\n`);

    const pos = await prisma.purchaseOrder.findMany({
      where: { projectId: project.id },
      select: { id: true, poNumber: true, supplierName: true, totalAmount: true, isQuote: true, originalFileUrl: true, lineItems: { select: { id: true, description: true, quantity: true, unitPrice: true, totalPrice: true } } },
    });
    console.log(`POs (${pos.length}):`);
    for (const p of pos) {
      console.log(`  ${p.id} | PO#${p.poNumber} | ${p.supplierName} | total=${p.totalAmount} | isQuote=${p.isQuote}`);
      console.log(`     url: ${p.originalFileUrl?.substring(0, 100)}`);
      for (const li of p.lineItems) console.log(`     [LI] ${li.description} | qty=${li.quantity} | price=${li.unitPrice} | total=${li.totalPrice}`);
    }

    const dns = await prisma.deliveryNote.findMany({
      where: { projectId: project.id },
      select: { id: true, noteNumber: true, supplierName: true, totalAmount: true, originalFileUrl: true, originalFileName: true, lineItems: { select: { id: true, description: true, quantity: true } } },
    });
    console.log(`\nDNs (${dns.length}):`);
    for (const d of dns) {
      console.log(`  ${d.id} | DN#${d.noteNumber} | ${d.supplierName} | total=${d.totalAmount}`);
      console.log(`     file: ${d.originalFileName}`);
      console.log(`     url: ${d.originalFileUrl?.substring(0, 100)}`);
      for (const li of d.lineItems) console.log(`     [LI] ${li.description} | qty=${li.quantity}`);
    }

    const invs = await prisma.invoice.findMany({
      where: { projectId: project.id },
      select: { id: true, invoiceNumber: true, supplierName: true, totalAmount: true, originalFileUrl: true, lineItems: { select: { id: true, description: true, quantity: true, unitPrice: true } } },
    });
    console.log(`\nInvoices (${invs.length}):`);
    for (const i of invs) {
      console.log(`  ${i.id} | Inv#${i.invoiceNumber} | ${i.supplierName} | total=${i.totalAmount}`);
      console.log(`     file: (n/a)`);
      console.log(`     url: ${i.originalFileUrl?.substring(0, 100)}`);
      for (const li of i.lineItems) console.log(`     [LI] ${li.description} | qty=${li.quantity} | price=${li.unitPrice}`);
    }

    const matches = await prisma.threeWayMatch.findMany({
      where: { purchaseOrderId: { in: pos.map((p) => p.id) } },
      select: {
        id: true, status: true, discrepancies: true, lineItemPairings: true,
        purchaseOrder: { select: { poNumber: true } },
        deliveryNotes: { select: { id: true, noteNumber: true } },
        invoices: { select: { id: true, invoiceNumber: true } },
      },
    });
    console.log(`\nMatches (${matches.length}):`);
    for (const m of matches) {
      const discs = Array.isArray(m.discrepancies) ? (m.discrepancies as any[]) : [];
      console.log(`\n  Match ${m.id} | PO#${m.purchaseOrder?.poNumber} | status=${m.status}`);
      const pairings = Array.isArray(m.lineItemPairings) ? (m.lineItemPairings as any[]) : [];
      console.log(`    LineItemPairings (${pairings.length}):`);
      for (const p of pairings) console.log(`      ${JSON.stringify(p).substring(0, 200)}`);
      console.log(`    DNs (${m.deliveryNotes.length}): ${m.deliveryNotes.map((d) => `DN#${d.noteNumber}`).join(', ')}`);
      console.log(`    Invoices (${m.invoices.length}): ${m.invoices.map((i) => `Inv#${i.invoiceNumber}`).join(', ')}`);
      console.log(`    Discrepancies: ${discs.length}`);
      for (const [idx, d] of discs.entries()) {
        console.log(`      [${idx + 1}] field=${d.field} | sev=${d.severity} | ${d.description || ''}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
