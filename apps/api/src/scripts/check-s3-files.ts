import { S3Client, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { config as dotenv } from 'dotenv';
import * as path from 'path';

dotenv({ path: path.resolve(__dirname, '../../.env') });

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
const bucket = process.env.S3_BUCKET!;

async function check(key: string) {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`✅ EXISTS: ${key}  (${r.ContentLength} bytes)`);
  } catch (e: any) {
    console.log(`❌ MISSING: ${key}  (${e.name})`);
  }
}

async function main() {
  const companyId = process.env.CHECK_COMPANY_ID;
  if (!companyId) throw new Error('Set CHECK_COMPANY_ID to the company to inspect');

  const prefix = `companies/${companyId}/documents/`;
  const keysFromDb = (process.env.CHECK_S3_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  for (const k of keysFromDb) await check(k);

  console.log('\n--- All files under the company prefix ---');
  const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  const filter = process.env.CHECK_S3_FILTER;
  for (const o of list.Contents || []) {
    if (!filter || o.Key?.includes(filter)) {
      console.log(`  ${o.Key}  (${o.Size} bytes)`);
    }
  }
}

main().catch(console.error);
