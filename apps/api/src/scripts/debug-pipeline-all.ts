/**
 * Debug script: uploads + processes ALL test documents via the full pipeline.
 * Runs in same process (no BullMQ) for deterministic results and full logging.
 *
 * Phase 1: DN + Invoice files (no PO)
 * Phase 2: PO file
 * Phase 3: Auto-match with DEBUG_MATCHING=true
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AgentOrchestratorService } from '../intelligence/agents/agent-orchestrator.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { MatchingService } from '../domain/matching/matching.service';
import * as fs from 'fs';
import * as path from 'path';

// Phase 1: DN + invoice files
const PHASE1_DOCS = [
  'test-docs/proj2/044 (3).pdf',
  'test-docs/proj2/255024903 (2).pdf',
  'test-docs/proj2/PO24001915_189.pdf',
];

// Phase 2: PO file
const PHASE2_DOCS = [
  'test-docs/proj2/הזמנת רכש (9).pdf',
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

  // Clear debug log
  try { fs.unlinkSync('/tmp/pipeline-debug.log'); } catch {}

  // ====== PHASE 1: DN + Invoice files ======
  console.log('\n' + '█'.repeat(60));
  console.log('█ PHASE 1: Processing DN + Invoice files');
  console.log('█'.repeat(60));

  for (const docPath of PHASE1_DOCS) {
    await processFile(orchestrator, storage, docPath, COMPANY_ID);
  }

  // Report: how many projects created?
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
    console.log('\n⚠️  DUPLICATE PROJECT DETECTED! Expected 1 project, got ' + projectsAfterPhase1.length);
  }

  // ====== PHASE 2: PO file ======
  console.log('\n' + '█'.repeat(60));
  console.log('█ PHASE 2: Processing PO file');
  console.log('█'.repeat(60));

  for (const docPath of PHASE2_DOCS) {
    await processFile(orchestrator, storage, docPath, COMPANY_ID);
  }

  // Report after PO
  const projectsAfterPhase2 = await prisma.project.findMany({
    where: { companyId: COMPANY_ID },
    include: {
      _count: { select: { deliveryNotes: true, purchaseOrders: true, invoices: true } },
    },
  });
  console.log(`\n📊 After Phase 2: ${projectsAfterPhase2.length} projects`);
  for (const p of projectsAfterPhase2) {
    const docCount = p._count.deliveryNotes + p._count.purchaseOrders + p._count.invoices;
    console.log(`  "${p.name}" — ${docCount} docs`);
  }

  // Wait for background auto-match tasks to complete before Phase 3
  console.log('\nWaiting 3s for background auto-match tasks to settle...');
  await new Promise((r) => setTimeout(r, 3000));

  // ====== PHASE 3: Auto-match ======
  console.log('\n' + '█'.repeat(60));
  console.log('█ PHASE 3: Running auto-match');
  console.log('█'.repeat(60));

  // Run auto-match for the entire company (no project filter — PO may not have a project yet)
  {
    const matchResult = await matching.autoMatch(COMPANY_ID);
    console.log(`Auto-match result: ${matchResult.matchesCreated} matches created`);

    // Show match details
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
  }

  // Find the project with documents for stats
  const mainProject = projectsAfterPhase2.find(p =>
    p._count.deliveryNotes > 0 || p._count.purchaseOrders > 0 || p._count.invoices > 0,
  );

  // Print debug matching log
  const debugDir = path.resolve('debug-logs');
  const debugFiles = fs.existsSync(debugDir) ? fs.readdirSync(debugDir).filter(f => f.startsWith('matching-debug')) : [];
  if (debugFiles.length > 0) {
    const latest = debugFiles.sort().pop()!;
    console.log(`\n📄 Matching debug: debug-logs/${latest}`);
    console.log(fs.readFileSync(path.join(debugDir, latest), 'utf-8').slice(0, 3000));
  }

  // Wait for any remaining background tasks before shutdown
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
