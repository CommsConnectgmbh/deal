/**
 * frame-inpaint.ts
 *
 * Prepares frame PNGs for inpainting via OpenAI's images.edit.
 *
 * Frame PNG structure (292x421):
 * - Exterior (outside card shape): transparent (alpha ≈ 0)
 * - Frame border / decorations: opaque with color (bright pixels)
 * - Interior (character area): opaque DARK background (needs to be replaced)
 *
 * Algorithm:
 * 1. BFS from image edges → mark exterior (transparent pixels)
 * 2. BFS from image center → mark interior (dark pixels, not exterior)
 * 3. Everything else = frame border (keep)
 *
 * Output:
 * - image: frame on dark bg (square PNG for DALL-E 2 edit)
 * - mask:  transparent where interior (AI generates here), opaque elsewhere
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from './config';

export interface FramePrep {
  image: Buffer;  // PNG: frame on dark bg
  mask: Buffer;   // PNG: transparent = edit zone
  width: number;
  height: number;
}

const cache = new Map<string, FramePrep>();

const ALPHA_THRESH = 30;       // pixels with alpha < this = "transparent"
const BRIGHTNESS_THRESH = 60;  // pixels with brightness < this = "dark" (interior)

function brightness(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export async function prepareFrame(
  frameType: string,
  canvasSize: number = 1024
): Promise<FramePrep> {
  const key = `${frameType}_${canvasSize}`;
  if (cache.has(key)) return cache.get(key)!;

  console.log(`  [Frame] Preparing "${frameType}" frame (${canvasSize}x${canvasSize})...`);

  // ── Load frame PNG ──
  const fileName = CONFIG.frameFiles[frameType];
  if (!fileName) throw new Error(`Unknown frame: ${frameType}`);
  const framePath = path.join(CONFIG.frameDir, fileName);
  if (!fs.existsSync(framePath)) throw new Error(`Frame not found: ${framePath}`);

  const rawFrame = fs.readFileSync(framePath);
  const meta = await sharp(rawFrame).metadata();
  const origW = meta.width!;
  const origH = meta.height!;

  // ── Scale frame to fit square canvas (96% fill) ──
  const fillRatio = 0.96;
  const scale = Math.min(
    (canvasSize * fillRatio) / origW,
    (canvasSize * fillRatio) / origH
  );
  const sw = Math.round(origW * scale);
  const sh = Math.round(origH * scale);
  const ox = Math.round((canvasSize - sw) / 2);
  const oy = Math.round((canvasSize - sh) / 2);

  const scaledRGBA = await sharp(rawFrame)
    .resize(sw, sh, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer();

  // ── STEP 1: BFS from edges → exterior (transparent pixels) ──
  const exterior = new Uint8Array(sw * sh);
  const extQueue: number[] = [];

  for (let x = 0; x < sw; x++) {
    const top = x;
    const bot = (sh - 1) * sw + x;
    if (scaledRGBA[top * 4 + 3] < ALPHA_THRESH) { exterior[top] = 1; extQueue.push(top); }
    if (scaledRGBA[bot * 4 + 3] < ALPHA_THRESH) { exterior[bot] = 1; extQueue.push(bot); }
  }
  for (let y = 0; y < sh; y++) {
    const left = y * sw;
    const right = y * sw + (sw - 1);
    if (scaledRGBA[left * 4 + 3] < ALPHA_THRESH) { exterior[left] = 1; extQueue.push(left); }
    if (scaledRGBA[right * 4 + 3] < ALPHA_THRESH) { exterior[right] = 1; extQueue.push(right); }
  }

  let head = 0;
  while (head < extQueue.length) {
    const idx = extQueue[head++];
    const x = idx % sw;
    const y = (idx - x) / sw;
    for (const n of [
      y > 0 ? idx - sw : -1,
      y < sh - 1 ? idx + sw : -1,
      x > 0 ? idx - 1 : -1,
      x < sw - 1 ? idx + 1 : -1,
    ]) {
      if (n >= 0 && !exterior[n] && scaledRGBA[n * 4 + 3] < ALPHA_THRESH) {
        exterior[n] = 1;
        extQueue.push(n);
      }
    }
  }

  // ── STEP 2: BFS from center → interior (dark OR transparent, not exterior) ──
  const interior = new Uint8Array(sw * sh);
  const intQueue: number[] = [];

  // Seed: center pixel
  const cx = Math.round(sw / 2);
  const cy = Math.round(sh / 2);
  const ci = cy * sw + cx;

  function isDarkOrTransparent(idx: number): boolean {
    const a = scaledRGBA[idx * 4 + 3];
    if (a < ALPHA_THRESH) return true; // transparent
    const b = brightness(scaledRGBA[idx * 4], scaledRGBA[idx * 4 + 1], scaledRGBA[idx * 4 + 2]);
    return b < BRIGHTNESS_THRESH; // dark
  }

  if (!exterior[ci] && isDarkOrTransparent(ci)) {
    interior[ci] = 1;
    intQueue.push(ci);
  } else {
    // Center might not be dark — try scanning nearby
    console.log(`  [Frame] Warning: center pixel not dark, scanning for interior seed...`);
    let found = false;
    for (let dy = -50; dy <= 50 && !found; dy += 5) {
      for (let dx = -50; dx <= 50 && !found; dx += 5) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= sw || ny < 0 || ny >= sh) continue;
        const ni = ny * sw + nx;
        if (!exterior[ni] && isDarkOrTransparent(ni)) {
          interior[ni] = 1;
          intQueue.push(ni);
          found = true;
        }
      }
    }
    if (!found) console.log(`  [Frame] ERROR: No interior seed found!`);
  }

  // BFS expand interior
  head = 0;
  while (head < intQueue.length) {
    const idx = intQueue[head++];
    const x = idx % sw;
    const y = (idx - x) / sw;
    for (const n of [
      y > 0 ? idx - sw : -1,
      y < sh - 1 ? idx + sw : -1,
      x > 0 ? idx - 1 : -1,
      x < sw - 1 ? idx + 1 : -1,
    ]) {
      if (n >= 0 && !exterior[n] && !interior[n] && isDarkOrTransparent(n)) {
        interior[n] = 1;
        intQueue.push(n);
      }
    }
  }

  const interiorCount = interior.reduce((s, v) => s + v, 0);
  const totalPixels = sw * sh;
  console.log(`  [Frame] Exterior: ${extQueue.length} px | Interior: ${interiorCount} px (${(interiorCount / totalPixels * 100).toFixed(1)}%)`);

  // ── BUILD IMAGE: frame on dark background ──
  const imgBuf = Buffer.alloc(canvasSize * canvasSize * 4);
  for (let i = 0; i < canvasSize * canvasSize; i++) {
    imgBuf[i * 4]     = 10;  // dark bg
    imgBuf[i * 4 + 1] = 10;
    imgBuf[i * 4 + 2] = 10;
    imgBuf[i * 4 + 3] = 255; // fully opaque
  }

  // Composite frame pixels (both border AND interior)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const si = (y * sw + x) * 4;
      const dx = x + ox;
      const dy = y + oy;
      if (dx < 0 || dx >= canvasSize || dy < 0 || dy >= canvasSize) continue;
      const di = (dy * canvasSize + dx) * 4;

      const a = scaledRGBA[si + 3] / 255;
      if (a > 0.01) {
        imgBuf[di]     = Math.round(scaledRGBA[si]     * a + imgBuf[di]     * (1 - a));
        imgBuf[di + 1] = Math.round(scaledRGBA[si + 1] * a + imgBuf[di + 1] * (1 - a));
        imgBuf[di + 2] = Math.round(scaledRGBA[si + 2] * a + imgBuf[di + 2] * (1 - a));
      }
    }
  }

  const image = await sharp(imgBuf, {
    raw: { width: canvasSize, height: canvasSize, channels: 4 }
  }).png().toBuffer();

  // ── BUILD MASK: transparent where interior (AI paints here) ──
  const maskBuf = Buffer.alloc(canvasSize * canvasSize * 4);
  // Default: fully opaque (= keep everything)
  for (let i = 0; i < canvasSize * canvasSize; i++) {
    maskBuf[i * 4]     = 0;
    maskBuf[i * 4 + 1] = 0;
    maskBuf[i * 4 + 2] = 0;
    maskBuf[i * 4 + 3] = 255;
  }

  // Interior → transparent (= AI generates character here)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (interior[y * sw + x]) {
        const dx = x + ox;
        const dy = y + oy;
        if (dx < 0 || dx >= canvasSize || dy < 0 || dy >= canvasSize) continue;
        const di = (dy * canvasSize + dx) * 4;
        maskBuf[di + 3] = 0; // transparent = edit zone
      }
    }
  }

  const mask = await sharp(maskBuf, {
    raw: { width: canvasSize, height: canvasSize, channels: 4 }
  }).png().toBuffer();

  console.log(`  [Frame] Image: ${(image.length / 1024).toFixed(0)}KB | Mask: ${(mask.length / 1024).toFixed(0)}KB`);

  const result: FramePrep = { image, mask, width: canvasSize, height: canvasSize };
  cache.set(key, result);
  return result;
}
