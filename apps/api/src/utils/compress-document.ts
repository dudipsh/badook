import * as path from 'path';

const JPEG_QUALITY = 75;

/**
 * Compresses a document buffer to grayscale JPEG.
 * - Images (PNG/JPEG): converted to grayscale JPEG at quality 75
 * - PDFs: each page rendered, converted to grayscale JPEG, reassembled into a compressed PDF
 * Returns the compressed buffer and the recommended file extension.
 */
export async function compressDocument(
  buffer: Buffer,
  filePath: string,
): Promise<{ buffer: Buffer; ext: string }> {
  const ext = path.extname(filePath).toLowerCase();

  if (['.png', '.jpg', '.jpeg'].includes(ext)) {
    return compressImage(buffer);
  }

  if (ext === '.pdf') {
    return compressPdf(buffer);
  }

  // Unsupported format — return as-is
  return { buffer, ext };
}

async function compressImage(buffer: Buffer): Promise<{ buffer: Buffer; ext: string }> {
  const sharp = (await import('sharp')).default;
  const compressed = await sharp(buffer)
    .rotate()
    .grayscale()
    .normalize()
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return { buffer: compressed, ext: '.jpg' };
}

async function compressPdf(buffer: Buffer): Promise<{ buffer: Buffer; ext: string }> {
  const sharp = (await import('sharp')).default;
  const { PDFDocument } = await import('pdf-lib');

  // Render each page to grayscale JPEG using mupdf
  const mupdf: any = await (Function('return import("mupdf")')());
  const m = mupdf.default || mupdf;
  const doc = m.Document.openDocument(buffer, 'application/pdf');
  const pageCount = doc.countPages();

  const pageImages: Buffer[] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const matrix = m.Matrix.scale(2, 2);
    const pixmap = page.toPixmap(matrix, m.ColorSpace.DeviceRGB);
    const pngBuf = Buffer.from(pixmap.asPNG());

    const jpegBuf = await sharp(pngBuf)
      .grayscale()
      .normalize()
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    pageImages.push(jpegBuf);
  }

  // Reassemble into a new PDF using pdf-lib
  const newPdf = await PDFDocument.create();

  for (const jpegBuf of pageImages) {
    const image = await newPdf.embedJpg(jpegBuf);
    const page = newPdf.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  const pdfBytes = await newPdf.save();
  return { buffer: Buffer.from(pdfBytes), ext: '.pdf' };
}
