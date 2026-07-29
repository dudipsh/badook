/**
 * Debug script: test OCR extraction and multi-doc detection directly, no HTTP/auth needed.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/debug-extract.ts <filePath> detect
 *   npx ts-node -r tsconfig-paths/register src/scripts/debug-extract.ts <filePath> extract [delivery_note|invoice|purchase_order]
 *
 * Example:
 *   cd apps/api
 *   npx ts-node -r tsconfig-paths/register src/scripts/debug-extract.ts ../../uploads/S0_BARSCAN-138742-5.pdf detect
 *   npx ts-node -r tsconfig-paths/register src/scripts/debug-extract.ts ../../uploads/S0_BARSCAN-138742-5.pdf extract delivery_note
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OcrService } from '../intelligence/ocr/ocr.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import * as path from 'path';

async function main() {
  const filePath = path.resolve(process.argv[2] || '../../uploads/S0_BARSCAN-138742-5.pdf');
  const mode = (process.argv[3] || 'detect') as 'detect' | 'extract';
  const docType = (process.argv[4] || 'delivery_note') as 'delivery_note' | 'invoice' | 'purchase_order';
  const noHint = process.argv.includes('--no-hint');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const ocr = app.get(OcrService);
  const prisma = app.get(PrismaService);

  // Use first company in DB
  const company = await prisma.company.findFirst({
    select: { id: true, name: true },
  });
  if (!company) throw new Error('No company found in database. Make sure DB is running.');
  const scanSettings = await prisma.companyScanSettings.findUnique({
    where: { companyId: company.id },
    select: { ocrProvider: true },
  });
  const ocrProvider = scanSettings?.ocrProvider ?? 'GEMINI';

  console.log('\n======================================================');
  console.log(`Company : ${company.name} (${company.id})`);
  console.log(`Provider: ${ocrProvider}`);
  console.log(`File    : ${filePath}`);
  console.log(`Mode    : ${mode}${mode === 'extract' ? ` (${docType})` : ''}`);
  console.log('======================================================\n');

  if (mode === 'detect') {
    console.log('Running multi-doc detection (splitting agent only, no extraction)...\n');
    const segments = await ocr.detectDocumentsInFile(filePath, company.id);
    console.log(`\nDetected ${segments.length} document(s):\n`);
    for (const seg of segments) {
      console.log(`  Pages ${seg.startPage}-${seg.endPage}: ${seg.documentType} | #${seg.documentNumber ?? '?'} | ${seg.filePath}`);
      if (seg.description) console.log(`    description: ${seg.description}`);
    }
    console.log('\nFull JSON:\n');
    console.log(JSON.stringify(segments, null, 2));

  } else {
    console.log(`Running DIRECT extraction (no splitting), type: ${docType}...\n`);
    const hint = noHint ? undefined :
      `\n\nNOTE: This file may contain MULTIPLE documents (a mix of delivery notes, invoices, purchase orders, etc.). ` +
      `Extract ONLY the ${docType.replace(/_/g, ' ')} document(s). Ignore pages belonging to other document types.`;

    let result: any;
    if (docType === 'invoice') {
      result = await ocr.parseInvoice(filePath, company.id, hint);
    } else if (docType === 'purchase_order') {
      result = await ocr.parsePurchaseOrder(filePath, company.id, hint);
    } else {
      result = await ocr.parseDeliveryNote(filePath, company.id, hint);
    }

    const items = result.lineItems ?? [];
    console.log(`\nExtracted ${items.length} line item(s) (confidence: ${result.confidence}):\n`);
    items.forEach((item: any, i: number) => {
      console.log(`  ${i + 1}. ${item.description} | qty: ${item.quantity} ${item.unit ?? ''} | price: ${item.unitPrice ?? '-'}`);
    });
    console.log('\nFull JSON:\n');
    console.log(JSON.stringify(result, null, 2));
  }

  await app.close();
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
