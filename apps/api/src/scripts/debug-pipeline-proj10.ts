/**
 * Debug script for proj10: 2 POs, 2 DNs, 2 Invoices from ניצבים
 * Runs full pipeline in-process (no BullMQ) with DB reset
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AgentOrchestratorService } from '../intelligence/agents/agent-orchestrator.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { MatchingService } from '../domain/matching/matching.service';
import * as fs from 'fs';
import * as path from 'path';

// Phase 1: DN + Invoice files first (they auto-create projects)
const PHASE1_DOCS = [
  'test-docs/proj10/SH2507723 (1).pdf',
  'test-docs/proj10/SH2508584 (1).pdf',
  'test-docs/proj10/203SI25008377 (1).pdf',
  'test-docs/proj10/203SI25007599 (1).pdf',
];

// Phase 2: PO files
const PHASE2_DOCS = [
  'test-docs/proj10/PO25004137 (1).pdf',
  'test-docs/proj10/PO25004679 (1).pdf',
];

async function main() {
  process.env.DEBUG_MATCHING = 'true';

  console.log('Bootstrapping NestJS app...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const orchestrator = app.get(AgentOrchestratorService);
  const storage = app.get(StorageService);
  const prisma = app.get(PrismaService);
  const matching = app.get(MatchingService);

  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('No company found in DB. Run seed first.');
    process.exit(1);
  }
  const COMPANY_ID = company.id;
  console.log(`Using company: ${COMPANY_ID}`);

  // Clean debug logs
  try { fs.unlinkSync('/tmp/pipeline-debug.log'); } catch {}
  const debugDir = path.resolve('debug-logs');
  if (fs.existsSync(debugDir)) {
    for (const f of fs.readdirSync(debugDir)) {
      if (f.startsWith('matching-debug')) fs.unlinkSync(path.join(debugDir, f));
    }
  }

  // ====== PHASE 1: DN + Invoice files ======
  console.log('\n' + '█'.repeat(60));
  console.log('█ PHASE 1: Processing DN + Invoice files');
  console.log('█'.repeat(60));

  for (const docPath of PHASE1_DOCS) {
    await processFile(orchestrator, storage, docPath, COMPANY_ID);
  }

  // Report Phase 1
  const projectsAfterPhase1 = await prisma.project.findMany({
    where: { companyId: COMPANY_ID },
    include: {
      _count: { select: { deliveryNotes: true, purchaseOrders: true, invoices: true } },
      addresses: { select: { address: true } },
    },
  });
  console.log(`\n📊 After Phase 1: ${projectsAfterPhase1.length} projects created:`);
  for (const p of projectsAfterPhase1) {
    const docCount = p._count.deliveryNotes + p._count.purchaseOrders + p._count.invoices;
    console.log(`  "${p.name}" — ${docCount} docs (${p._count.deliveryNotes} DN, ${p._count.purchaseOrders} PO, ${p._count.invoices} INV)`);
    if (p.addresses.length > 0) {
      console.log(`    Secondary addresses: ${p.addresses.map(a => `"${a.address}"`).join(', ')}`);
    }
  }
  if (projectsAfterPhase1.length > 1) {
    console.log('\n⚠️  MULTIPLE PROJECTS! Expected 1, got ' + projectsAfterPhase1.length);
  }

  // ====== PHASE 2: PO files ======
  console.log('\n' + '█'.repeat(60));
  console.log('█ PHASE 2: Processing PO files');
  console.log('█'.repeat(60));

  for (const docPath of PHASE2_DOCS) {
    await processFile(orchestrator, storage, docPath, COMPANY_ID);
  }

  // Report Phase 2
  const allPOs = await prisma.purchaseOrder.findMany({
    where: { companyId: COMPANY_ID },
    select: { poNumber: true, supplierName: true, projectId: true, status: true },
  });
  console.log(`\n📊 After Phase 2: ${allPOs.length} POs:`);
  for (const po of allPOs) {
    console.log(`  PO ${po.poNumber} — supplier="${po.supplierName}" project=${po.projectId || 'ORPHAN'} status=${po.status}`);
  }

  // Check for POs saved as DNs (fallback)
  const failedPOs = await prisma.deliveryNote.findMany({
    where: {
      companyId: COMPANY_ID,
      parsedData: { path: ['_failedAsPO'], equals: true },
    },
    select: { noteNumber: true, supplierName: true, parsedData: true },
  });
  if (failedPOs.length > 0) {
    console.log(`\n⚠️ ${failedPOs.length} POs saved as DN fallback:`);
    for (const dn of failedPOs) {
      const pd = dn.parsedData as any;
      console.log(`  "${pd._originalPoNumber}" — supplier="${dn.supplierName}"`);
    }
  }

  // Wait for background tasks
  console.log('\nWaiting 3s for background tasks...');
  await new Promise((r) => setTimeout(r, 3000));

  // ====== PHASE 3: Auto-match ======
  console.log('\n' + '█'.repeat(60));
  console.log('█ PHASE 3: Running auto-match');
  console.log('█'.repeat(60));

  const matchResult = await matching.autoMatch(COMPANY_ID);
  console.log(`Auto-match: ${matchResult.matchesCreated} matches created`);

  const matches = await prisma.threeWayMatch.findMany({
    where: { companyId: COMPANY_ID },
    include: {
      purchaseOrder: { select: { poNumber: true, supplierName: true } },
      deliveryNotes: { select: { noteNumber: true, supplierName: true } },
      invoices: { select: { invoiceNumber: true, supplierName: true } },
    },
  });
  console.log(`\n📊 Matches: ${matches.length}`);
  for (const m of matches) {
    const po = m.purchaseOrder ? `PO: ${m.purchaseOrder.poNumber}` : 'no PO';
    const dns = m.deliveryNotes.map(d => d.noteNumber).join(', ') || 'no DN';
    const invs = m.invoices.map(i => i.invoiceNumber).join(', ') || 'no INV';
    const discCount = Array.isArray(m.discrepancies) ? (m.discrepancies as any[]).length : 0;
    console.log(`  [${m.status}] ${po} | DN: ${dns} | INV: ${invs} | ${discCount} discrepancies`);
  }

  // Final summary
  const finalProjects = await prisma.project.findMany({
    where: { companyId: COMPANY_ID },
    include: {
      _count: { select: { deliveryNotes: true, purchaseOrders: true, invoices: true } },
    },
  });
  console.log('\n' + '═'.repeat(60));
  console.log('FINAL SUMMARY:');
  console.log(`  Projects: ${finalProjects.length}`);
  for (const p of finalProjects) {
    console.log(`  "${p.name}" — ${p._count.deliveryNotes} DN, ${p._count.purchaseOrders} PO, ${p._count.invoices} INV`);
  }
  console.log(`  Total POs: ${allPOs.length}`);
  console.log(`  Total matches: ${matches.length}`);
  console.log('═'.repeat(60));

  // Debug matching logs
  if (fs.existsSync(debugDir)) {
    const files = fs.readdirSync(debugDir).filter(f => f.startsWith('matching-debug')).sort();
    for (const f of files) {
      console.log(`\n📄 ${f}:`);
      console.log(fs.readFileSync(path.join(debugDir, f), 'utf-8').slice(0, 3000));
    }
  }

  await new Promise((r) => setTimeout(r, 2000));
  await app.close();
}

async function processFile(
  orchestrator: AgentOrchestratorService,
  storage: StorageService,
  docPath: string,
  companyId: string,
) {
  const fullPath = path.resolve(docPath);
  const fileName = path.basename(docPath);
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Processing: ${fileName}`);
  console.log('─'.repeat(50));

  const buffer = fs.readFileSync(fullPath);
  const s3Path = await storage.upload(buffer, fileName, companyId);

  try {
    const result = await orchestrator.processFile({
      companyId,
      filePath: s3Path,
      source: 'MANUAL',
      originalFileName: fileName,
      force: true,
    });
    console.log(`Result: processed=${result.processed}, failed=${result.failed}, docs=${result.documents.length}`);
    for (const doc of result.documents) {
      console.log(`  ${doc.documentType}: ${doc.status} ${doc.projectId ? '→ project' : '(orphan)'} (${doc.documentId})`);
    }
  } catch (err) {
    console.error(`Error processing ${fileName}:`, err);
  }
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
