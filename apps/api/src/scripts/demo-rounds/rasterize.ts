// apps/api/src/scripts/demo-rounds/rasterize.ts
// Flattens a vector PDF into an image-only PDF (one rasterized page per page).
//
// Why: pdf-lib draws Hebrew glyphs in visual order, which makes the rendered
// image correct but leaves the embedded TEXT LAYER scrambled (each Hebrew word
// reversed). Pipelines that read the text layer then ingest gibberish. Real
// supplier documents arriving by email are usually scans anyway, so we discard
// the text layer entirely and keep only the rendered image — the OCR engine
// reads the (correct) picture, exactly like a real scanned document.
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

const A4: [number, number] = [595, 842];

/** True if the poppler `pdftoppm` rasterizer is on PATH. */
export const hasRasterizer = (): boolean => {
  try {
    execSync('command -v pdftoppm', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

export const flattenToImagePdf = async (
  vectorPdf: Buffer,
  dpi = 150,
): Promise<Buffer> => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-flat-'));
  try {
    const srcPath = path.join(tmpDir, 'src.pdf');
    fs.writeFileSync(srcPath, vectorPdf);
    const prefix = path.join(tmpDir, 'page');
    execSync(
      `pdftoppm -png -r ${dpi} ${JSON.stringify(srcPath)} ${JSON.stringify(prefix)}`,
      { stdio: 'ignore' },
    );
    const pngs = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith('page') && f.endsWith('.png'))
      .sort();
    const out = await PDFDocument.create();
    for (const file of pngs) {
      const img = await out.embedPng(fs.readFileSync(path.join(tmpDir, file)));
      const page = out.addPage(A4);
      page.drawImage(img, { x: 0, y: 0, width: A4[0], height: A4[1] });
    }
    return Buffer.from(await out.save());
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
