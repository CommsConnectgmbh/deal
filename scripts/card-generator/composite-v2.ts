/**
 * composite-v2.ts — SIMPLE compositing
 *
 * 1. Load frame PNG, make dark interior pixels transparent
 * 2. Resize portrait to fill the frame area
 * 3. Sharp composite: dark bg → portrait → frame on top
 *
 * No BFS, no masks, no distance transforms. Just simple layering.
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from './config';

/** Cache prepared frames (with transparent interior) */
const frameCache = new Map<string, { png: Buffer; sw: number; sh: number; ox: number; oy: number }>();

/**
 * Prepare a frame: scale it and make dark interior pixels transparent.
 * The frame PNG has: transparent exterior, opaque bright border, opaque dark interior.
 * We make the dark interior transparent so the portrait shows through.
 */
async function prepareFrame(frameType: string, canvasSize: number) {
  const key = `${frameType}_${canvasSize}`;
  if (frameCache.has(key)) return frameCache.get(key)!;

  const fileName = CONFIG.frameFiles[frameType];
  if (!fileName) throw new Error(`Unknown frame: ${frameType}`);
  const framePath = path.join(CONFIG.frameDir, fileName);
  if (!fs.existsSync(framePath)) throw new Error(`Frame not found: ${framePath}`);

  const rawFrame = fs.readFileSync(framePath);
  const meta = await sharp(rawFrame).metadata();

  // Scale to 96% of canvas
  const scale = Math.min(
    (canvasSize * 0.96) / meta.width!,
    (canvasSize * 0.96) / meta.height!
  );
  const sw = Math.round(meta.width! * scale);
  const sh = Math.round(meta.height! * scale);
  const ox = Math.round((canvasSize - sw) / 2);
  const oy = Math.round((canvasSize - sh) / 2);

  // Get raw RGBA pixels
  const rgba = await sharp(rawFrame)
    .resize(sw, sh, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Make dark interior pixels transparent
  // Exterior: already transparent (alpha < 30)
  // Frame border: opaque + bright → keep
  // Interior: opaque + dark → make transparent
  const modified = Buffer.from(rgba);
  const DARK_THRESH = 80; // brightness below this = dark interior (frame borders are 150+)

  for (let i = 0; i < sw * sh; i++) {
    const a = modified[i * 4 + 3];
    if (a < 30) continue; // already transparent exterior

    const r = modified[i * 4], g = modified[i * 4 + 1], b = modified[i * 4 + 2];
    const bright = 0.299 * r + 0.587 * g + 0.114 * b;

    if (bright < DARK_THRESH) {
      modified[i * 4 + 3] = 0; // make transparent
    }
  }

  // Convert back to PNG
  const png = await sharp(modified, { raw: { width: sw, height: sh, channels: 4 } })
    .png()
    .toBuffer();

  console.log(`  [Frame] ${frameType}: ${sw}x${sh}, prepared (dark interior → transparent)`);

  const result = { png, sw, sh, ox, oy };
  frameCache.set(key, result);
  return result;
}

/**
 * Composite a DALL-E 3 portrait INTO the real frame PNG.
 *
 * Simple 3-layer approach:
 * 1. Dark background (canvas)
 * 2. Portrait (resized to fill frame area)
 * 3. Frame on top (dark interior = transparent, portrait shows through)
 */
export async function compositeCardV2(
  portraitPng: Buffer,
  frameType: string
): Promise<Buffer> {
  const canvasSize = CONFIG.canvasSize;
  const frame = await prepareFrame(frameType, canvasSize);

  // Resize portrait to cover the full frame area
  // fit:'cover' fills both dimensions, cropping excess (sides for tall frames)
  const portraitResized = await sharp(portraitPng)
    .resize(frame.sw, frame.sh, { fit: 'cover' })
    .png()
    .toBuffer();

  // Composite: dark bg → portrait (centered) → frame on top (centered)
  const result = await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 10, g: 10, b: 10, alpha: 255 },
    },
  })
    .composite([
      { input: portraitResized, left: frame.ox, top: frame.oy },
      { input: frame.png, left: frame.ox, top: frame.oy },
    ])
    .png()
    .toBuffer();

  return result;
}
