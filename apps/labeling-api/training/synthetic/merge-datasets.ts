// ─── Merge Datasets ─────────────────────────────────────────────
// CLI tool to merge a real export ZIP with synthetic output.
//
// Usage:
//   npx tsx merge-datasets.ts \
//     --real ../../temp/export.zip \
//     --synthetic output/synthetic-2026-04-08/ \
//     --real-oversample 3 \
//     --output ../../temp/merged.zip

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import * as archiver from 'archiver';

// ─── CLI Argument Parsing ───────────────────────────────────────

interface MergeArgs {
  realZip: string;
  syntheticDir: string;
  realOversample: number;
  outputZip: string;
}

function parseArgs(): MergeArgs {
  const args = process.argv.slice(2);
  let realZip = '';
  let syntheticDir = '';
  let realOversample = 1;
  let outputZip = '';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--real':
        realZip = args[++i];
        break;
      case '--synthetic':
        syntheticDir = args[++i];
        break;
      case '--real-oversample':
        realOversample = parseInt(args[++i], 10);
        break;
      case '--output':
        outputZip = args[++i];
        break;
    }
  }

  if (!realZip) {
    console.error('Error: --real <path-to-zip> is required');
    process.exit(1);
  }
  if (!syntheticDir) {
    console.error('Error: --synthetic <path-to-dir> is required');
    process.exit(1);
  }
  if (!outputZip) {
    console.error('Error: --output <path-to-zip> is required');
    process.exit(1);
  }
  if (realOversample < 1) {
    realOversample = 1;
  }

  return {
    realZip: path.resolve(realZip),
    syntheticDir: path.resolve(syntheticDir),
    realOversample,
    outputZip: path.resolve(outputZip),
  };
}

// ─── JSONL Parsing ──────────────────────────────────────────────

interface TrainingExample {
  id: string;
  messages: Array<{
    role: string;
    content: Array<{ type: string; image?: string; text?: string }>;
  }>;
}

function readJsonl(filePath: string): TrainingExample[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as TrainingExample);
}

// ─── Deterministic Shuffle (Fisher-Yates with seed) ─────────────

function seededShuffle<T>(arr: T[], seed: number): T[] {
  let state = seed | 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── ZIP Creation ───────────────────────────────────────────────

function createZip(sourceDir: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver.default('zip', { zlib: { level: 6 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  console.log('[MergeDatasets] Configuration:');
  console.log(`  Real ZIP: ${args.realZip}`);
  console.log(`  Synthetic dir: ${args.syntheticDir}`);
  console.log(`  Real oversample: ${args.realOversample}x`);
  console.log(`  Output ZIP: ${args.outputZip}`);

  // Validate inputs
  if (!fs.existsSync(args.realZip)) {
    console.error(`Error: Real ZIP not found: ${args.realZip}`);
    process.exit(1);
  }
  if (!fs.existsSync(args.syntheticDir)) {
    console.error(`Error: Synthetic directory not found: ${args.syntheticDir}`);
    process.exit(1);
  }

  const syntheticJsonl = path.join(args.syntheticDir, 'train.jsonl');
  if (!fs.existsSync(syntheticJsonl)) {
    console.error(`Error: train.jsonl not found in synthetic directory`);
    process.exit(1);
  }

  // Step 1: Extract real ZIP to temp directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-'));
  const realExtractDir = path.join(tempDir, 'real');
  fs.mkdirSync(realExtractDir, { recursive: true });

  console.log('\n[1/7] Extracting real ZIP...');
  execSync(`unzip -q -o "${args.realZip}" -d "${realExtractDir}"`);

  const realJsonlPath = path.join(realExtractDir, 'train.jsonl');
  if (!fs.existsSync(realJsonlPath)) {
    console.error('Error: train.jsonl not found in real ZIP');
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }

  // Step 2: Read real train.jsonl
  console.log('[2/7] Reading real training data...');
  const realExamples = readJsonl(realJsonlPath);
  console.log(`  Found ${realExamples.length} real samples`);

  // Step 3: Read synthetic train.jsonl
  console.log('[3/7] Reading synthetic training data...');
  const syntheticExamples = readJsonl(syntheticJsonl);
  console.log(`  Found ${syntheticExamples.length} synthetic samples`);

  // Step 4: Oversample real data
  console.log(`[4/7] Oversampling real data ${args.realOversample}x...`);
  const oversampledReal: TrainingExample[] = [];
  for (let rep = 0; rep < args.realOversample; rep++) {
    for (const example of realExamples) {
      oversampledReal.push({
        ...example,
        id: rep === 0 ? example.id : `${example.id}_dup${rep}`,
      });
    }
  }
  console.log(`  Oversampled: ${oversampledReal.length} real samples`);

  // Step 5: Combine and shuffle
  console.log('[5/7] Combining and shuffling...');
  const combined = seededShuffle([...oversampledReal, ...syntheticExamples], 42);

  // Step 6: Build merged output directory
  console.log('[6/7] Building merged output...');
  const mergedDir = path.join(tempDir, 'merged');
  const mergedImagesDir = path.join(mergedDir, 'images');
  fs.mkdirSync(mergedImagesDir, { recursive: true });

  // Copy real images
  const realImagesDir = path.join(realExtractDir, 'images');
  if (fs.existsSync(realImagesDir)) {
    const realImages = fs.readdirSync(realImagesDir);
    for (const img of realImages) {
      fs.copyFileSync(
        path.join(realImagesDir, img),
        path.join(mergedImagesDir, img),
      );
    }
    console.log(`  Copied ${realImages.length} real images`);
  }

  // Copy synthetic images (already prefixed with 'syn_')
  const synImagesDir = path.join(args.syntheticDir, 'images');
  if (fs.existsSync(synImagesDir)) {
    const synImages = fs.readdirSync(synImagesDir);
    for (const img of synImages) {
      const destName = img.startsWith('syn_') ? img : `syn_${img}`;
      fs.copyFileSync(
        path.join(synImagesDir, img),
        path.join(mergedImagesDir, destName),
      );
    }
    console.log(`  Copied ${synImages.length} synthetic images`);
  }

  // Update image paths in synthetic examples if prefix was added
  const mergedJsonlLines = combined.map((example) => {
    const updated = { ...example };
    updated.messages = example.messages.map((msg) => ({
      ...msg,
      content: msg.content.map((c) => {
        if (c.type === 'image' && c.image) {
          const filename = path.basename(c.image);
          const prefixedFilename = filename.startsWith('syn_') ? filename : filename;
          return { ...c, image: `images/${prefixedFilename}` };
        }
        return c;
      }),
    }));
    return JSON.stringify(updated);
  });

  // Write merged train.jsonl
  fs.writeFileSync(
    path.join(mergedDir, 'train.jsonl'),
    mergedJsonlLines.join('\n'),
  );

  // Read both metadata files and merge
  const realMetaPath = path.join(realExtractDir, 'metadata.json');
  const synMetaPath = path.join(args.syntheticDir, 'metadata.json');

  const realMeta = fs.existsSync(realMetaPath)
    ? JSON.parse(fs.readFileSync(realMetaPath, 'utf-8'))
    : {};
  const synMeta = fs.existsSync(synMetaPath)
    ? JSON.parse(fs.readFileSync(synMetaPath, 'utf-8'))
    : {};

  // Build merged byType counts
  const mergedByType: Record<string, number> = {};
  for (const [k, v] of Object.entries((realMeta.byType ?? {}) as Record<string, number>)) {
    mergedByType[k] = (mergedByType[k] || 0) + v * args.realOversample;
  }
  for (const [k, v] of Object.entries((synMeta.byType ?? {}) as Record<string, number>)) {
    mergedByType[k] = (mergedByType[k] || 0) + v;
  }

  const mergedMetadata = {
    exportDate: new Date().toISOString(),
    format: 'vertex-ai',
    source: 'merged',
    totalSamples: combined.length,
    realSamples: oversampledReal.length,
    syntheticSamples: syntheticExamples.length,
    realOversample: args.realOversample,
    byType: mergedByType,
    styleProfiles: synMeta.styleProfiles ?? {},
  };

  fs.writeFileSync(
    path.join(mergedDir, 'metadata.json'),
    JSON.stringify(mergedMetadata, null, 2),
  );

  // Step 7: Create output ZIP
  console.log('[7/7] Creating output ZIP...');
  const outputDir = path.dirname(args.outputZip);
  fs.mkdirSync(outputDir, { recursive: true });
  await createZip(mergedDir, args.outputZip);

  // Clean up temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log('\n[MergeDatasets] Done!');
  console.log(`  Total samples: ${combined.length}`);
  console.log(`    Real (oversampled ${args.realOversample}x): ${oversampledReal.length}`);
  console.log(`    Synthetic: ${syntheticExamples.length}`);
  console.log(`  Output: ${args.outputZip}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
