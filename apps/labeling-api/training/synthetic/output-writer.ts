// ─── Output Writer ──────────────────────────────────────────────
// Writes synthetic documents to disk in the exact format expected
// by the training pipeline (matching export.service.ts output).

import * as fs from 'fs';
import * as path from 'path';

// ─── Prompt Loading ─────────────────────────────────────────────

const PROMPTS_DIR = path.resolve(__dirname, '..', '..', 'src', 'ocr', 'prompts');

const promptCache = new Map<string, string>();

const DOC_TYPE_PROMPT_MAP: Record<string, string> = {
  delivery_note: 'delivery-note.md',
  invoice: 'invoice.md',
  purchase_order: 'purchase-order.md',
};

function loadPrompt(docType: string): string {
  if (promptCache.has(docType)) return promptCache.get(docType)!;

  const filename = DOC_TYPE_PROMPT_MAP[docType];
  if (!filename) {
    throw new Error(`Unknown document type for prompt loading: ${docType}`);
  }

  const promptPath = path.join(PROMPTS_DIR, filename);
  const sharedRulesPath = path.join(PROMPTS_DIR, 'shared-rules.md');

  if (!fs.existsSync(promptPath)) {
    throw new Error(`Prompt file not found: ${promptPath}`);
  }
  if (!fs.existsSync(sharedRulesPath)) {
    throw new Error(`Shared rules file not found: ${sharedRulesPath}`);
  }

  const promptContent = fs.readFileSync(promptPath, 'utf-8');
  const sharedRules = fs.readFileSync(sharedRulesPath, 'utf-8');
  const result = promptContent.replace('{{SHARED_RULES}}', sharedRules);

  promptCache.set(docType, result);
  return result;
}

// ─── Types ──────────────────────────────────────────────────────

interface OutputDocument {
  id: string;
  docType: string;
  groundTruth: unknown;
  imageBuffer: Buffer;
  styleProfile: string;
}

// ─── Write Output ───────────────────────────────────────────────

export async function writeOutput(
  outputDir: string,
  documents: OutputDocument[],
): Promise<void> {
  const imagesDir = path.join(outputDir, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });

  const jsonlLines: string[] = [];

  // Count by type and style profile
  const byType: Record<string, number> = {};
  const styleProfiles: Record<string, number> = {};

  for (const doc of documents) {
    // Write image
    const imageFilename = `${doc.id}.png`;
    const imagePath = path.join(imagesDir, imageFilename);
    fs.writeFileSync(imagePath, doc.imageBuffer);

    // Load the extraction prompt for this document type
    const prompt = loadPrompt(doc.docType);

    // Build training example (matching export.service.ts format)
    const example = {
      id: doc.id,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: `images/${imageFilename}` },
            { type: 'text', text: prompt },
          ],
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: JSON.stringify(doc.groundTruth) },
          ],
        },
      ],
    };

    jsonlLines.push(JSON.stringify(example));

    // Track counts
    byType[doc.docType] = (byType[doc.docType] || 0) + 1;
    styleProfiles[doc.styleProfile] = (styleProfiles[doc.styleProfile] || 0) + 1;
  }

  // Write train.jsonl
  const jsonlPath = path.join(outputDir, 'train.jsonl');
  fs.writeFileSync(jsonlPath, jsonlLines.join('\n'));

  // Normalize type keys for metadata (DELIVERY_NOTE, INVOICE, PURCHASE_ORDER)
  const byTypeNormalized: Record<string, number> = {};
  for (const [key, count] of Object.entries(byType)) {
    byTypeNormalized[key.toUpperCase()] = count;
  }

  // Write metadata.json
  const metadata = {
    exportDate: new Date().toISOString(),
    format: 'vertex-ai',
    source: 'synthetic',
    totalSamples: documents.length,
    byType: byTypeNormalized,
    styleProfiles,
  };

  fs.writeFileSync(
    path.join(outputDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
  );

  console.log(`[OutputWriter] Wrote ${documents.length} samples to ${outputDir}`);
  console.log(`  train.jsonl: ${jsonlLines.length} lines`);
  console.log(`  images/: ${documents.length} PNGs`);
  console.log(`  metadata.json: written`);
}
