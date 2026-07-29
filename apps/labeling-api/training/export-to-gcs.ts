/**
 * Export verified samples from production labeling-api to GCS for Vertex AI fine-tuning.
 *
 * Fetches samples via the REST API, downloads images, uploads to GCS,
 * and creates a Vertex AI-compatible JSONL file.
 *
 * Usage: npx tsx training/export-to-gcs.ts
 */
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}`);
    process.exit(1);
  }
  return value;
};

const PROD_URL = requireEnv('LABELING_API_URL');
const PROD_API_KEY = requireEnv('LABELING_API_KEY');
const BUCKET_NAME = requireEnv('GCS_BUCKET');
const PROJECT_ID = requireEnv('GCP_PROJECT_ID');

interface Sample {
  id: string;
  documentType: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER';
  status: string;
  originalFileName: string;
  filePath: string;
  groundTruth: Record<string, unknown> | null;
  geminiExtraction: Record<string, unknown> | null;
}

const META_FIELDS = ['confidence', 'fieldConfidence'];

const stripMetaAndNulls = (obj: unknown): unknown => {
  if (Array.isArray(obj)) return obj.map(stripMetaAndNulls);
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (META_FIELDS.includes(key)) continue;
      if (val === null || val === undefined) continue;
      result[key] = stripMetaAndNulls(val);
    }
    return result;
  }
  return obj;
};

const loadPromptFile = (name: string): string => {
  const promptPath = path.join(__dirname, '..', 'src', 'ocr', 'prompts', name);
  if (fs.existsSync(promptPath)) return fs.readFileSync(promptPath, 'utf-8');
  return `Extract all fields from this document. Return JSON.`;
};

const DOC_TYPE_PROMPT: Record<string, string> = {
  DELIVERY_NOTE: 'delivery-note.md',
  INVOICE: 'invoice.md',
  PURCHASE_ORDER: 'purchase-order.md',
};

async function main() {
  console.log('🔄 Fetching samples from production...');

  // Fetch all samples (paginated)
  const allSamples: Sample[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${PROD_URL}/samples?page=${page}&limit=50&status=VERIFIED`, {
      headers: { 'x-api-key': PROD_API_KEY },
    });
    const data = await res.json() as { samples: Sample[]; total: number };
    allSamples.push(...data.samples);
    if (allSamples.length >= data.total || data.samples.length === 0) break;
    page++;
  }

  // Also fetch LABELED samples
  page = 1;
  while (true) {
    const res = await fetch(`${PROD_URL}/samples?page=${page}&limit=50&status=LABELED`, {
      headers: { 'x-api-key': PROD_API_KEY },
    });
    const data = await res.json() as { samples: Sample[]; total: number };
    allSamples.push(...data.samples);
    if (allSamples.length >= data.total || data.samples.length === 0) break;
    page++;
  }

  const withGroundTruth = allSamples.filter((s) => s.groundTruth);
  console.log(`✅ Found ${allSamples.length} samples, ${withGroundTruth.length} with ground truth`);

  if (withGroundTruth.length === 0) {
    console.error('❌ No samples with ground truth found');
    process.exit(1);
  }

  // Initialize GCS
  const storage = new Storage({ projectId: PROJECT_ID });
  const bucket = storage.bucket(BUCKET_NAME);
  const ts = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
  const gcsPrefix = `training/vertex-${ts}`;

  // Load system prompt
  const systemPrompt = loadPromptFile('shared-rules.md');

  // Download images and build JSONL
  const tmpDir = path.join(__dirname, '..', 'output', `export-${ts}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const jsonlLines: string[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const sample of withGroundTruth) {
    try {
      process.stdout.write(`  📥 ${sample.originalFileName}...`);

      // Download file
      const fileRes = await fetch(`${PROD_URL}/files/${sample.id}`, {
        headers: { 'x-api-key': PROD_API_KEY },
      });
      if (!fileRes.ok) {
        console.log(` ❌ download failed (${fileRes.status})`);
        errorCount++;
        continue;
      }

      const contentType = fileRes.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await fileRes.arrayBuffer());

      // Determine extension and mime
      let ext = '.jpg';
      let mimeType = 'image/jpeg';
      if (contentType.includes('png')) { ext = '.png'; mimeType = 'image/png'; }
      else if (contentType.includes('pdf')) { ext = '.pdf'; mimeType = 'application/pdf'; }
      else if (contentType.includes('jpeg') || contentType.includes('jpg')) { ext = '.jpg'; mimeType = 'image/jpeg'; }

      // Upload to GCS
      const gcsPath = `${gcsPrefix}/images/${sample.id}${ext}`;
      await bucket.file(gcsPath).save(buffer, { contentType: mimeType });
      const gcsUri = `gs://${BUCKET_NAME}/${gcsPath}`;

      // Build Vertex AI training example
      const docPrompt = loadPromptFile(DOC_TYPE_PROMPT[sample.documentType]);
      const cleanedGt = stripMetaAndNulls(sample.groundTruth!);

      const example: Record<string, unknown> = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: docPrompt },
              { fileData: { mimeType, fileUri: gcsUri } },
            ],
          },
          {
            role: 'model',
            parts: [{ text: JSON.stringify(cleanedGt) }],
          },
        ],
      };

      if (systemPrompt) {
        example.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      jsonlLines.push(JSON.stringify(example));
      successCount++;
      console.log(` ✅`);
    } catch (err) {
      console.log(` ❌ ${err}`);
      errorCount++;
    }
  }

  // Upload train.jsonl to GCS
  const jsonlContent = jsonlLines.join('\n');
  const jsonlGcsPath = `${gcsPrefix}/train.jsonl`;
  await bucket.file(jsonlGcsPath).save(jsonlContent, { contentType: 'application/jsonl' });

  // Also save locally
  const localJsonlPath = path.join(tmpDir, 'train.jsonl');
  fs.writeFileSync(localJsonlPath, jsonlContent);

  const gcsUri = `gs://${BUCKET_NAME}/${jsonlGcsPath}`;
  console.log(`\n🎯 Export complete!`);
  console.log(`   Samples: ${successCount} exported, ${errorCount} failed`);
  console.log(`   JSONL: ${gcsUri}`);
  console.log(`   Local copy: ${localJsonlPath}`);
  console.log(`\n📋 Next: run fine-tuning with:`);
  console.log(`   python3 training/finetune_vertex.py --training-data ${gcsUri} --project ${PROJECT_ID}`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
