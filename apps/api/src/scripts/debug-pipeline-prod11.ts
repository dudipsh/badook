/**
 * Debug script for prod11: Container waste invoice bundle
 * - 1 Invoice (חשבונית מכולות.Pdf) - summary invoice #14823889
 * - 1 Invoice Detail (פרוט חשבונית מכולות.Pdf) - detail sheet for same invoice
 * - 19 Delivery Notes in 1 PDF (ריכוז תעודות מכולות.Pdf) - 19 pages, 1 DN each
 *
 * Expected results:
 * - 1 invoice with 1 line item (qty=19, unitPrice=1200, total=22800)
 * - 19 delivery notes (one per page), each qty=1
 * - 1 project: סיירה / הארבעה 13, ת"א
 * - Invoice detail should NOT create a separate document (or be handled gracefully)
 *
 * Runs full pipeline in-process (no BullMQ) with DB reset
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AgentOrchestratorService } from '../intelligence/agents/agent-orchestrator.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { MatchingService } from '../domain/matching/matching.service';
import { ProjectBackfillService } from '../domain/projects/project-backfill.service';
import * as fs from 'fs';
import * as path from 'path';

// All 3 files in upload order
const ALL_DOCS = [
  'test-docs/prod11/ריכוז תעודות מכולות.Pdf',     // 19-page DN bundle (process first)
  'test-docs/prod11/חשבונית מכולות.Pdf',            // Summary invoice
  'test-docs/prod11/פרוט חשבונית מכולות.Pdf',       // Invoice detail sheet
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
  const backfill = app.get(ProjectBackfillService);

  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('No company found in DB. Run seed first.');
    process.exit(1);
  }
  const COMPANY_ID = company.id;
  console.log(`Using company: ${COMPANY_ID}`);

  // ====== DB RESET ======
  console.log('\n🗑️  Resetting database (keeping company + users)...');
  await resetDocumentData(prisma, COMPANY_ID);
  console.log('✅ Database reset complete');

  // Clean debug logs
  try { fs.unlinkSync('/tmp/pipeline-debug.log'); } catch {}
  const debugDir = path.resolve('debug-logs');
  if (fs.existsSync(debugDir)) {
    for (const f of fs.readdirSync(debugDir)) {
      if (f.startsWith('matching-debug')) fs.unlinkSync(path.join(debugDir, f));
    }
  }

  // ====== PROCESS ALL FILES ======
  console.log('\n' + '█'.repeat(60));
  console.log('█ Processing all prod11 documents');
  console.log('█'.repeat(60));

  const allResults: { file: string; result: any }[] = [];

  for (const docPath of ALL_DOCS) {
    const result = await processFile(orchestrator, storage, docPath, COMPANY_ID);
    allResults.push({ file: path.basename(docPath), result });
  }

  // Wait for background tasks
  console.log('\nWaiting 5s for background tasks (auto-match, compression)...');
  await new Promise((r) => setTimeout(r, 5000));

  // ====== POST-SCAN: Backfill + Match ======
  console.log('\n' + '█'.repeat(60));
  console.log('█ Running post-scan: backfill + auto-match');
  console.log('█'.repeat(60));

  await backfill.backfillProjects(COMPANY_ID);
  const matchResult = await matching.autoMatch(COMPANY_ID);
  console.log(`Auto-match: ${matchResult.matchesCreated} matches created`);

  // ====== DETAILED REPORT ======
  await printDetailedReport(prisma, COMPANY_ID);

  // ====== VALIDATION ======
  await validateResults(prisma, COMPANY_ID);

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

async function resetDocumentData(prisma: PrismaService, companyId: string) {
  // Delete in dependency order (children first)
  await prisma.$transaction([
    prisma.itemMatchFeedback.deleteMany({ where: { companyId } }),
    prisma.lineItem.deleteMany({ where: { deliveryNote: { companyId } } }),
    prisma.invoiceLineItem.deleteMany({ where: { invoice: { companyId } } }),
    prisma.pOLineItem.deleteMany({ where: { purchaseOrder: { companyId } } }),
    prisma.threeWayMatch.deleteMany({ where: { companyId } }),
    prisma.deliveryNote.deleteMany({ where: { companyId } }),
    prisma.invoice.deleteMany({ where: { companyId } }),
    prisma.purchaseOrder.deleteMany({ where: { companyId } }),
    prisma.projectAddress.deleteMany({ where: { project: { companyId } } }),
    prisma.project.deleteMany({ where: { companyId } }),
    prisma.processingJob.deleteMany({ where: { companyId } }),
    prisma.emailScanAttachment.deleteMany({ where: { emailScanLog: { companyId } } }),
    prisma.emailScanLog.deleteMany({ where: { companyId } }),
    prisma.supplier.deleteMany({ where: { companyId } }),
    prisma.priceFingerprint.deleteMany({ where: { companyId } }),
  ]);
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
  console.log(`📄 Processing: ${fileName}`);
  console.log('─'.repeat(50));

  const buffer = fs.readFileSync(fullPath);
  const s3Path = await storage.upload(buffer, fileName, companyId);

  try {
    const result = await orchestrator.processFile({
      companyId,
      filePath: s3Path,
      source: 'MANUAL',
      originalFileName: fileName,
      force: false,
    });
    console.log(`✅ Result: processed=${result.processed}, skipped=${result.skipped}, failed=${result.failed}, docs=${result.documents.length}`);
    for (const doc of result.documents) {
      const projLabel = doc.projectId ? `→ project ${doc.projectId.slice(0, 8)}...` : '(orphan)';
      console.log(`  ${doc.documentType}: ${doc.status} ${projLabel} [${doc.documentId?.slice(0, 8)}]`);
      if (doc.orphanReason) console.log(`    orphan reason: ${doc.orphanReason}`);
      if (doc.error) console.log(`    error: ${doc.error}`);
    }
    return result;
  } catch (err) {
    console.error(`❌ Error processing ${fileName}:`, err);
    return null;
  }
}

async function printDetailedReport(prisma: PrismaService, companyId: string) {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 DETAILED REPORT');
  console.log('═'.repeat(60));

  // Projects
  const projects = await prisma.project.findMany({
    where: { companyId },
    include: {
      _count: { select: { deliveryNotes: true, purchaseOrders: true, invoices: true } },
      addresses: { select: { address: true } },
    },
  });
  console.log(`\n🏗️  Projects: ${projects.length}`);
  for (const p of projects) {
    const docCount = p._count.deliveryNotes + p._count.purchaseOrders + p._count.invoices;
    console.log(`  "${p.name}" — ${docCount} docs (${p._count.deliveryNotes} DN, ${p._count.purchaseOrders} PO, ${p._count.invoices} INV)`);
    console.log(`    address: "${p.address || 'none'}"`);
    if (p.addresses.length > 0) {
      console.log(`    secondary: ${p.addresses.map(a => `"${a.address}"`).join(', ')}`);
    }
  }

  // Delivery Notes
  const dns = await prisma.deliveryNote.findMany({
    where: { companyId },
    select: {
      noteNumber: true,
      supplierName: true,
      projectId: true,
      status: true,
      deliveryDate: true,
      _count: { select: { lineItems: true } },
    },
    orderBy: { deliveryDate: 'asc' },
  });
  console.log(`\n📦 Delivery Notes: ${dns.length}`);
  const orphanDNs = dns.filter(d => !d.projectId);
  const projectDNs = dns.filter(d => d.projectId);
  console.log(`  ✅ With project: ${projectDNs.length}`);
  console.log(`  ⚠️  Orphans: ${orphanDNs.length}`);
  for (const dn of dns.slice(0, 25)) {
    const proj = dn.projectId ? `proj=${dn.projectId.slice(0, 8)}` : 'ORPHAN';
    console.log(`  ${dn.noteNumber || 'no-number'} | ${dn.deliveryDate || 'no-date'} | ${dn.status} | ${dn._count.lineItems} items | ${proj}`);
  }
  if (dns.length > 25) console.log(`  ... and ${dns.length - 25} more`);

  // Invoices
  const invoices = await prisma.invoice.findMany({
    where: { companyId },
    include: {
      lineItems: { select: { description: true, quantity: true, unitPrice: true, totalPrice: true } },
    },
  });
  console.log(`\n🧾 Invoices: ${invoices.length}`);
  for (const inv of invoices) {
    const proj = inv.projectId ? `proj=${inv.projectId.slice(0, 8)}` : 'ORPHAN';
    console.log(`  #${inv.invoiceNumber} | ${inv.supplierName} | ${inv.status} | ${inv.lineItems.length} items | total=${inv.totalAmount} | ${proj}`);
    for (const item of inv.lineItems) {
      console.log(`    - ${item.description}: qty=${item.quantity} × price=${item.unitPrice} = ${item.totalPrice}`);
    }
  }

  // Matches
  const matches = await prisma.threeWayMatch.findMany({
    where: { companyId },
    include: {
      purchaseOrder: { select: { poNumber: true } },
      deliveryNotes: { select: { noteNumber: true } },
      invoices: { select: { invoiceNumber: true } },
    },
  });
  console.log(`\n🔗 Three-Way Matches: ${matches.length}`);
  for (const m of matches) {
    const po = m.purchaseOrder ? `PO: ${m.purchaseOrder.poNumber}` : 'no PO';
    const dnList = m.deliveryNotes.map(d => d.noteNumber).join(', ') || 'no DN';
    const invList = m.invoices.map(i => i.invoiceNumber).join(', ') || 'no INV';
    console.log(`  [${m.status}] ${po} | DN: ${dnList} | INV: ${invList}`);
  }
}

async function validateResults(prisma: PrismaService, companyId: string) {
  console.log('\n' + '═'.repeat(60));
  console.log('🧪 VALIDATION');
  console.log('═'.repeat(60));

  const projects = await prisma.project.findMany({ where: { companyId } });
  const dns = await prisma.deliveryNote.findMany({
    where: { companyId },
    select: { noteNumber: true, projectId: true, status: true },
  });
  const invoices = await prisma.invoice.findMany({
    where: { companyId },
    select: { invoiceNumber: true, projectId: true, status: true, totalAmount: true },
  });
  const orphanDNs = dns.filter(d => !d.projectId);
  const orphanInvoices = invoices.filter(i => !i.projectId);
  const emptyProjects = projects.filter(async p => {
    const count = await prisma.deliveryNote.count({ where: { projectId: p.id } })
      + await prisma.invoice.count({ where: { projectId: p.id } })
      + await prisma.purchaseOrder.count({ where: { projectId: p.id } });
    return count === 0;
  });

  let issues = 0;

  // Check 1: Should have exactly 1 project (or at most 2 if addresses differ)
  if (projects.length === 0) {
    console.log('❌ FAIL: No projects created');
    issues++;
  } else if (projects.length > 2) {
    console.log(`❌ FAIL: Too many projects (${projects.length}). Expected 1-2 for same site.`);
    issues++;
  } else {
    console.log(`✅ Projects: ${projects.length}`);
  }

  // Check 2: Should have delivery notes (ideally 19)
  if (dns.length === 0) {
    console.log('❌ FAIL: No delivery notes created');
    issues++;
  } else if (dns.length < 10) {
    console.log(`⚠️  WARN: Only ${dns.length} delivery notes (expected ~19)`);
    issues++;
  } else {
    console.log(`✅ Delivery notes: ${dns.length}`);
  }

  // Check 3: Should have at least 1 invoice
  if (invoices.length === 0) {
    console.log('❌ FAIL: No invoices created');
    issues++;
  } else {
    console.log(`✅ Invoices: ${invoices.length}`);
    // Check invoice total
    const mainInvoice = invoices.find(i => i.invoiceNumber === '14823889');
    if (mainInvoice) {
      if (mainInvoice.totalAmount && Math.abs(Number(mainInvoice.totalAmount) - 26904) < 10) {
        console.log('✅ Invoice total matches (26,904 ₪)');
      } else {
        console.log(`⚠️  WARN: Invoice total is ${mainInvoice.totalAmount}, expected ~26904`);
      }
    }
  }

  // Check 4: Orphan count
  if (orphanDNs.length > 5) {
    console.log(`⚠️  WARN: ${orphanDNs.length} orphan delivery notes`);
    issues++;
  } else {
    console.log(`✅ Orphan DNs: ${orphanDNs.length}`);
  }

  if (orphanInvoices.length > 0) {
    console.log(`⚠️  WARN: ${orphanInvoices.length} orphan invoices`);
    issues++;
  } else {
    console.log('✅ No orphan invoices');
  }

  // Check 5: Duplicate invoices (same number)
  const invoiceNumbers = invoices.map(i => i.invoiceNumber);
  const duplicates = invoiceNumbers.filter((n, i) => invoiceNumbers.indexOf(n) !== i);
  if (duplicates.length > 0) {
    console.log(`❌ FAIL: Duplicate invoice numbers: ${duplicates.join(', ')}`);
    issues++;
  } else {
    console.log('✅ No duplicate invoice numbers');
  }

  // Check 6: DN note numbers should match the known 19
  const expectedNoteNumbers = [
    '193401', '193454', '193413', '193411', '188726', '188733', '188737',
    '188749', '173993', '188505', '193448', '188518', '189560', '189566',
    '203936', '188765', '188541', '188546', '193564',
  ];
  const foundNoteNumbers = dns.map(d => d.noteNumber).filter((n): n is string => n != null);
  const missingNotes = expectedNoteNumbers.filter(n => !foundNoteNumbers.includes(n));
  const unexpectedNotes = foundNoteNumbers.filter(n => !expectedNoteNumbers.includes(n));
  if (missingNotes.length > 0) {
    console.log(`⚠️  WARN: Missing DN numbers: ${missingNotes.join(', ')}`);
  }
  if (unexpectedNotes.length > 0) {
    console.log(`⚠️  WARN: Unexpected DN numbers: ${unexpectedNotes.join(', ')}`);
  }
  if (missingNotes.length === 0 && unexpectedNotes.length === 0 && foundNoteNumbers.length === 19) {
    console.log('✅ All 19 delivery note numbers match');
  }

  console.log('\n' + '═'.repeat(60));
  if (issues === 0) {
    console.log('🎉 ALL VALIDATIONS PASSED!');
  } else {
    console.log(`⚠️  ${issues} issue(s) found — see details above`);
  }
  console.log('═'.repeat(60));
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
