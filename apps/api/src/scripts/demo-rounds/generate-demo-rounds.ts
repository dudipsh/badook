// apps/api/src/scripts/demo-rounds/generate-demo-rounds.ts
// Generates fake procurement "rounds" (PO + delivery notes + invoice) as
// supplier-styled PDFs, writes a manifest + expected-answers cheat sheet,
// and zips ONLY the document folders (so the cheat sheet is never emailed
// by mistake).
//
// By default each PDF is flattened to an IMAGE-ONLY page (like a scan) so the
// OCR pipeline reads the rendered picture, not pdf-lib's scrambled RTL text
// layer. Pass --vector to keep the original vector PDFs.
//
// Usage (from apps/api):
//   npx tsx src/scripts/demo-rounds/generate-demo-rounds.ts \
//     [--out ../../uploads/demo-rounds] [--config ./my-items.json] [--seed 7] [--vector]
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { DEFAULT_CONFIG } from './catalog';
import { buildRounds } from './rounds-builder';
import { buildExpectedAnswers, renderExpectedAnswersMd } from './expected-answers';
import { renderDemoDocPdf } from './pdf-renderer';
import { flattenToImagePdf, hasRasterizer } from './rasterize';
import { DemoConfig, DemoDoc } from './types';

const argValue = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const loadConfig = (): DemoConfig => {
  let config = DEFAULT_CONFIG;
  const configPath = argValue('--config');
  if (configPath) {
    const overrides = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Partial<DemoConfig>;
    config = { ...DEFAULT_CONFIG, ...overrides };
  }
  const seedArg = argValue('--seed');
  if (seedArg) config = { ...config, seed: Number(seedArg) };
  return config;
};

// User convention: export archives are named by date+time, never random ids.
const timestamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}`
  );
};

const main = async () => {
  const config = loadConfig();
  const outBase = path.resolve(
    argValue('--out') ?? path.join(__dirname, '../../../../../uploads/demo-rounds'),
  );
  const stamp = timestamp();
  const runDir = path.join(outBase, `demo-rounds-${stamp}`);
  fs.mkdirSync(runDir, { recursive: true });

  const rounds = buildRounds(config);

  // Image-only PDFs by default so the OCR pipeline reads the rendered picture
  // (correct Hebrew) instead of pdf-lib's reversed text layer. Falls back to
  // vector if --vector is passed or pdftoppm is missing.
  const imageMode = !process.argv.includes('--vector') && hasRasterizer();
  if (!imageMode && !process.argv.includes('--vector')) {
    console.warn('⚠ pdftoppm not found — writing vector PDFs (text layer may OCR as reversed Hebrew).');
  }
  console.log(imageMode ? 'Mode: image-only (scanned-look) PDFs' : 'Mode: vector PDFs');

  for (const round of rounds) {
    const dirName = `round-${String(round.index + 1).padStart(2, '0')}-${round.scenario}`;
    const roundDir = path.join(runDir, dirName);
    fs.mkdirSync(roundDir, { recursive: true });
    const docs: DemoDoc[] = [round.po, ...round.deliveryNotes, round.invoice];
    for (const doc of docs) {
      const vector = await renderDemoDocPdf(doc, config);
      const finalPdf = imageMode ? await flattenToImagePdf(vector) : vector;
      fs.writeFileSync(path.join(roundDir, doc.fileName), finalPdf);
    }
    console.log(
      `✓ ${dirName} — ${docs.length} PDFs (${round.supplier.name} → ${round.project.name})`,
    );
  }

  const answers = buildExpectedAnswers(rounds, config.items);
  fs.writeFileSync(
    path.join(runDir, 'manifest.json'),
    JSON.stringify({ seed: config.seed, generatedAt: stamp, rounds }, null, 2),
  );
  fs.writeFileSync(
    path.join(runDir, 'expected-answers.md'),
    renderExpectedAnswersMd(answers, rounds),
  );

  const zipPath = path.join(outBase, `demo-rounds-${stamp}.zip`);
  execSync(`zip -r ${JSON.stringify(zipPath)} round-*`, { cwd: runDir, stdio: 'inherit' });

  console.log(`\nZIP (לשליחה במייל): ${zipPath}`);
  console.log(`Cheat sheet (לא לשלוח!): ${path.join(runDir, 'expected-answers.md')}`);
};

void main();
