import { PrismaClient } from '@prisma/client';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { config as dotenv } from 'dotenv';
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

async function exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let problems = 0;

  for (const model of ['invoice', 'deliveryNote', 'purchaseOrder'] as const) {
    const client = (prisma as any)[model];
    const docs = await client.findMany({
      select: { id: true, originalFileUrl: true, originalFileUrlHq: true, createdAt: true },
    });
    console.log(`\n=== ${model} (${docs.length}) ===`);
    for (const d of docs) {
      if (!d.originalFileUrl?.startsWith('companies/')) continue;
      const primaryExists = await exists(d.originalFileUrl);
      if (!primaryExists) {
        problems++;
        const hqExists = d.originalFileUrlHq ? await exists(d.originalFileUrlHq) : false;
        console.log(`  ❌ ${model} ${d.id}`);
        console.log(`     primary: ${d.originalFileUrl} (MISSING)`);
        console.log(`     hq:      ${d.originalFileUrlHq || 'null'} ${d.originalFileUrlHq ? (hqExists ? '(exists)' : '(MISSING)') : ''}`);
        console.log(`     created: ${d.createdAt}`);
      }
    }
  }

  console.log(`\nTotal records with missing primary file: ${problems}`);
  await prisma.$disconnect();
}

main().catch(console.error);
