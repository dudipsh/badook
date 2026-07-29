// ─── Post-Processor ────────────────────────────────────────────
// Applies scan-like augmentation effects to rendered document PNGs.
// Uses a seeded PRNG (passed in) so results are deterministic.

import sharp from 'sharp';

// ─── Types ─────────────────────────────────────────────────────

export type StyleProfile =
  | 'clean_digital'
  | 'good_scan'
  | 'poor_scan'
  | 'worn_annotated';

// ─── Style Profile Selection (weighted) ────────────────────────

const PROFILE_WEIGHTS: Array<{ profile: StyleProfile; cumulative: number }> = [
  { profile: 'clean_digital', cumulative: 0.30 },
  { profile: 'good_scan', cumulative: 0.60 },
  { profile: 'poor_scan', cumulative: 0.85 },
  { profile: 'worn_annotated', cumulative: 1.0 },
];

export function pickStyleProfile(random: () => number): StyleProfile {
  const r = random();
  for (const entry of PROFILE_WEIGHTS) {
    if (r < entry.cumulative) return entry.profile;
  }
  return 'clean_digital';
}

// ─── Utility ───────────────────────────────────────────────────

function randomInRange(
  random: () => number,
  min: number,
  max: number,
): number {
  return min + random() * (max - min);
}

function randomInt(random: () => number, min: number, max: number): number {
  return Math.floor(randomInRange(random, min, max + 1));
}

// ─── Vignette (Edge Darkening) ─────────────────────────────────

async function createVignetteOverlay(
  width: number,
  height: number,
  intensity: number, // 0-1, how dark the edges get
): Promise<Buffer> {
  // Build a radial gradient using raw pixel data.
  // Center is transparent, edges are dark.
  const channels = 4; // RGBA
  const data = Buffer.alloc(width * height * channels);

  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;

      // Smooth falloff: stronger at edges
      const factor = Math.pow(dist, 2.0);
      const alpha = Math.round(factor * intensity * 255);

      const offset = (y * width + x) * channels;
      data[offset] = 0; // R
      data[offset + 1] = 0; // G
      data[offset + 2] = 0; // B
      data[offset + 3] = Math.min(alpha, 255); // A
    }
  }

  return sharp(data, { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

// ─── Profile Implementations ───────────────────────────────────

async function applyCleanDigital(
  buffer: Buffer,
  random: () => number,
): Promise<Buffer> {
  // Slight brightness variation only
  const brightness = randomInRange(random, 0.97, 1.03);
  return sharp(buffer)
    .modulate({ brightness })
    .png()
    .toBuffer();
}

async function applyGoodScan(
  buffer: Buffer,
  random: () => number,
): Promise<Buffer> {
  const rotation = randomInRange(random, 0.5, 1.0);
  const rotateClockwise = random() > 0.5;
  const angle = rotateClockwise ? rotation : -rotation;

  return sharp(buffer)
    .grayscale()
    .rotate(angle, { background: '#ffffff' })
    .normalize()
    .png()
    .toBuffer();
}

async function applyPoorScan(
  buffer: Buffer,
  random: () => number,
): Promise<Buffer> {
  const rotation = randomInRange(random, 1.0, 3.0);
  const rotateClockwise = random() > 0.5;
  const angle = rotateClockwise ? rotation : -rotation;
  const blurSigma = randomInRange(random, 0.5, 1.0);
  const jpegQuality = randomInt(random, 40, 70);

  // Apply grayscale + rotation + blur
  let processed = await sharp(buffer)
    .grayscale()
    .rotate(angle, { background: '#ffffff' })
    .blur(blurSigma)
    .toBuffer();

  // JPEG artifact pass: save as JPEG then back to PNG
  const jpegBuffer = await sharp(processed)
    .jpeg({ quality: jpegQuality })
    .toBuffer();

  return sharp(jpegBuffer)
    .png()
    .toBuffer();
}

async function applyWornAnnotated(
  buffer: Buffer,
  random: () => number,
): Promise<Buffer> {
  // Start with poor_scan effects
  const rotation = randomInRange(random, 1.0, 3.0);
  const rotateClockwise = random() > 0.5;
  const angle = rotateClockwise ? rotation : -rotation;
  const blurSigma = randomInRange(random, 0.5, 1.0);
  const jpegQuality = randomInt(random, 40, 70);
  const brightness = randomInRange(random, 0.85, 1.10);
  const vignetteIntensity = randomInRange(random, 0.3, 0.6);

  // Grayscale + rotation + blur
  let processed = await sharp(buffer)
    .grayscale()
    .rotate(angle, { background: '#ffffff' })
    .blur(blurSigma)
    .modulate({ brightness })
    .toBuffer();

  // JPEG artifacts
  const jpegBuffer = await sharp(processed)
    .jpeg({ quality: jpegQuality })
    .toBuffer();

  processed = await sharp(jpegBuffer)
    .png()
    .toBuffer();

  // Edge darkening (vignette)
  const metadata = await sharp(processed).metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const vignetteOverlay = await createVignetteOverlay(
    width,
    height,
    vignetteIntensity,
  );

  return sharp(processed)
    .composite([{ input: vignetteOverlay, blend: 'over' }])
    .png()
    .toBuffer();
}

// ─── Main Entry Point ──────────────────────────────────────────

export async function applyPostProcessing(
  imageBuffer: Buffer,
  profile: StyleProfile,
  random: () => number,
): Promise<Buffer> {
  switch (profile) {
    case 'clean_digital':
      return applyCleanDigital(imageBuffer, random);
    case 'good_scan':
      return applyGoodScan(imageBuffer, random);
    case 'poor_scan':
      return applyPoorScan(imageBuffer, random);
    case 'worn_annotated':
      return applyWornAnnotated(imageBuffer, random);
    default:
      return imageBuffer;
  }
}
