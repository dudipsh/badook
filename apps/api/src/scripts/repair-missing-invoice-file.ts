import { PrismaClient } from '@prisma/client';
import { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { config as dotenv } from 'dotenv';
import { PDFDocument } from 'pdf-lib';
import * as path from 'path';

dotenv({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();
const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
const bucket = process.env.S3_BUCKET!;

async function s3Exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function s3GetBuffer(key: string): Promise<Buffer> {
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return Buffer.from(await r.Body!.transformToByteArray());
}

async function s3Put(key: string, buf: Buffer) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buf, ContentType: 'application/pdf' }));
}

/** Extract pages [startPage..endPage] (1-based) from a source PDF buffer. */
async function extractPages(sourceBuf: Buffer, startPage: number, endPage: number): Promise<Buffer> {
  const src = await PDFDocument.load(sourceBuf);
  const dst = await PDFDocument.create();
  const indices: number[] = [];
  for (let i = startPage - 1; i < endPage && i < src.getPageCount(); i++) indices.push(i);
  const copied = await dst.copyPages(src, indices);
  for (const p of copied) dst.addPage(p);
  return Buffer.from(await dst.save());
}

/** From a segment key like "...invoice_11493_p1-1.pdf" derive parent "...invoice_11493.pdf" + [1, 1]. */
function parseSegmentKey(key: string): { parent: string; start: number; end: number } | null {
  const m = key.match(/^(.+)_p(\d+)-(\d+)\.pdf$/);
  if (!m) return null;
  return { parent: `${m[1]}.pdf`, start: parseInt(m[2], 10), end: parseInt(m[3], 10) };
}

async function main() {
  const invoices = await prisma.invoice.findMany({
    select: { id: true, invoiceNumber: true, originalFileUrl: true, originalFileUrlHq: true },
  });

  for (const inv of invoices) {
    if (!inv.originalFileUrl?.startsWith('companies/')) continue;
    if (await s3Exists(inv.originalFileUrl)) continue; // already fine

    console.log(`\nRepairing Invoice #${inv.invoiceNumber} (id=${inv.id})`);
    console.log(`  Missing: ${inv.originalFileUrl}`);

    const parsed = parseSegmentKey(inv.originalFileUrl);
    if (!parsed) {
      console.log(`  ⚠️  Not a segment URL, skipping`);
      continue;
    }

    if (!(await s3Exists(parsed.parent))) {
      console.log(`  ⚠️  Parent multi-doc PDF also missing: ${parsed.parent}, skipping`);
      continue;
    }

    console.log(`  Re-extracting p${parsed.start}-${parsed.end} from ${parsed.parent}`);
    const parentBuf = await s3GetBuffer(parsed.parent);
    const segBuf = await extractPages(parentBuf, parsed.start, parsed.end);
    await s3Put(inv.originalFileUrl, segBuf);
    console.log(`  ✅ Uploaded ${segBuf.length} bytes to ${inv.originalFileUrl}`);

    // Verify
    if (!(await s3Exists(inv.originalFileUrl))) {
      console.log(`  ❌ Verification failed — file still missing after upload`);
    } else {
      console.log(`  ✅ Verified on S3`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
