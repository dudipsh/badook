export type PreprocessLevel = 'normal' | 'aggressive' | 'pdf' | 'pdf-scanned';

/**
 * Sharp-based image preprocessing for OCR quality improvement.
 *
 * Level guide:
 *   'pdf'         — digitally-generated PDF (ERP printout, Priority, SAP): clean raster, minimal touch
 *   'pdf-scanned' — scanned paper → PDF: apply binarization to eliminate gray scan noise
 *   'normal'      — phone camera photo of a document: gentle enhancement
 *   'aggressive'  — washed-out / shadowy phone camera doc: strong enhancement + binarize
 */
export async function preprocessImage(
  buffer: Buffer,
  level: PreprocessLevel = 'normal',
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;

  let pipeline = sharp(buffer);
  const metadata = await pipeline.metadata();

  pipeline = pipeline.rotate();
  pipeline = pipeline.grayscale();

  if (level === 'pdf') {
    pipeline = pipeline.normalize().sharpen({ sigma: 0.5 });
  } else if (level === 'pdf-scanned') {
    pipeline = pipeline.normalize().sharpen({ sigma: 1.5 }).threshold(140);
  } else if (level === 'aggressive') {
    pipeline = pipeline.normalize().sharpen({ sigma: 2.0 }).threshold(150);
  } else {
    pipeline = pipeline.normalize().sharpen({ sigma: 1.2 });
  }

  if (metadata.width && metadata.width > 6000) {
    pipeline = pipeline.resize(4800, null, { withoutEnlargement: true });
  }

  return pipeline.png({ compressionLevel: 6 }).toBuffer();
}
