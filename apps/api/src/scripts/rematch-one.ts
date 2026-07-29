/**
 * Re-run matcher for a specific ThreeWayMatch to verify fixes.
 * Usage: npx tsx src/scripts/rematch-one.ts <matchId>
 *        npx tsx src/scripts/rematch-one.ts --po <poNumber>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MatchPostprocessorService } from '../domain/matching/match-postprocessor.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

async function main() {
  const args = process.argv.slice(2);
  let matchId: string | null = null;
  let poNumber: string | null = null;

  if (args[0] === '--po' && args[1]) poNumber = args[1];
  else if (args[0]) matchId = args[0];

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);
  const postprocessor = app.get(MatchPostprocessorService);

  let match;
  if (matchId) {
    match = await prisma.threeWayMatch.findUnique({ where: { id: matchId } });
  } else if (poNumber) {
    match = await prisma.threeWayMatch.findFirst({
      where: { purchaseOrder: { poNumber } },
    });
  } else {
    const matches = await prisma.threeWayMatch.findMany({
      include: { purchaseOrder: { select: { poNumber: true } } },
    });
    console.log('Available matches:');
    for (const m of matches) {
      console.log(`  ${m.id} | PO#${m.purchaseOrder?.poNumber} | companyId=${m.companyId}`);
    }
    await app.close();
    return;
  }

  if (!match) {
    console.error('Match not found');
    await app.close();
    process.exit(1);
  }

  console.log(`Re-matching match ${match.id} (companyId=${match.companyId})...`);
  await postprocessor.recomputeModifiedMatches({
    companyId: match.companyId,
    companyName: null,
    unmatchedPOs: [],
    unmatchedDNs: [],
    unmatchedInvoices: [],
    matchedPOSet: new Set<string>(),
    matchedDNSet: new Set<string>(),
    matchedInvSet: new Set<string>(),
    created: [],
    updatedMatchIds: new Set([match.id]),
  });

  const updated = await prisma.threeWayMatch.findUnique({
    where: { id: match.id },
    select: { id: true, status: true, lineItemPairings: true, discrepancies: true },
  });
  const pairings = Array.isArray(updated?.lineItemPairings) ? (updated!.lineItemPairings as any[]) : [];
  console.log(`\nPost-match status: ${updated?.status}`);
  console.log(`Pairings (${pairings.length}):`);
  for (const p of pairings) {
    const po = p.po ? `PO[${p.po.index}] qty=${p.po.quantity}` : 'no-PO';
    const dn = p.dn ? `DN[${p.dn.index}] qty=${p.dn.quantity}` : 'no-DN';
    const inv = p.inv ? `INV[${p.inv.index}] qty=${p.inv.quantity}` : 'no-INV';
    console.log(`  [${p.matchSource || '?'}] ${po} | ${dn} | ${inv}`);
  }
  const discs = Array.isArray(updated?.discrepancies) ? (updated!.discrepancies as any[]) : [];
  console.log(`\nDiscrepancies (${discs.length}):`);
  for (const d of discs) {
    console.log(`  ${d.field} | ${d.severity} | ${d.description || ''}`);
  }

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
