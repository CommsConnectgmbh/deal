import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { CONFIG } from './config';

// Caches
const rawFrameCache = new Map<string, Buffer>();
const overlayFrameCache = new Map<string, Buffer>();
const shapeMaskCache = new Map<string, Buffer>();

/**
 * Load raw frame PNG buffer (cached).
 */
export async function loadFrameBuffer(frameType: string): Promise<Buffer> {
  if (rawFrameCache.has(frameType)) return rawFrameCache.get(frameType)!;

  const fileName = CONFIG.frameFiles[frameType];
  if (!fileName) throw new Error(`No frame file for: "${frameType}"`);

  const framePath = path.join(CONFIG.frameDir, fileName);
  if (!fs.existsSync(framePath)) throw new Error(`Frame not found: ${framePath}`);

  const buffer = await sharp(framePath).ensureAlpha().png().toBuffer();
  rawFrameCache.set(frameType, buffer);
  return buffer;
}

/**
 * Create overlay frame: dark interior → graduated transparency.
 * Instead of a hard threshold, we use a smooth gradient:
 * - Very dark pixels (brightness < 30) → fully transparent
 * - Medium dark (30-80) → semi-transparent (smooth fade)
 * - Bright pixels (frame deco) → fully opaque
 * This creates a natural blend between portrait and frame decorations.
 */
async function getOverlayFrame(frameType: string): Promise<Buffer> {
  if (overlayFrameCache.has(frameType)) return overlayFrameCache.get(frameType)!;

  const rawBuffer = await loadFrameBuffer(frameType);
  const { data, info } = await sharp(rawBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const processed = Buffer.from(data);

  const LOW = 30;   // below this: fully transparent
  const HIGH = 90;  // above this: fully opaque (frame decoration)

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const r = processed[idx];
    const g = processed[idx + 1];
    const b = processed[idx + 2];
    const a = processed[idx + 3];
    const brightness = Math.max(r, g, b);

    // Only process opaque pixels (frame interior)
    if (a > 200) {
      if (brightness < LOW) {
        // Very dark → fully transparent (portrait shows through)
        processed[idx + 3] = 0;
      } else if (brightness < HIGH) {
        // Gradient zone → smooth fade from transparent to opaque
        const t = (brightness - LOW) / (HIGH - LOW);
        processed[idx + 3] = Math.round(t * a);
      }
      // brightness >= HIGH → keep original alpha (frame decoration)
    }
  }

  const overlay = await sharp(processed, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();

  overlayFrameCache.set(frameType, overlay);
  return overlay;
}

/**
 * Create shape mask via flood-fill from edges.
 * Inside card shape = opaque white, outside = transparent.
 */
async function buildShapeMask(frameType: string): Promise<Buffer> {
  if (shapeMaskCache.has(frameType)) return shapeMaskCache.get(frameType)!;

  const frameBuffer = await loadFrameBuffer(frameType);
  const { data, info } = await sharp(frameBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;

  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    alpha[i] = data[i * 4 + 3];
  }

  const TRANSPARENT_THRESHOLD = 30;
  const outside = new Uint8Array(w * h);
  const queue: number[] = [];

  // Seed edges
  for (let x = 0; x < w; x++) {
    if (alpha[x] < TRANSPARENT_THRESHOLD) { outside[x] = 1; queue.push(x); }
    const bottom = (h - 1) * w + x;
    if (alpha[bottom] < TRANSPARENT_THRESHOLD) { outside[bottom] = 1; queue.push(bottom); }
  }
  for (let y = 0; y < h; y++) {
    const left = y * w;
    if (alpha[left] < TRANSPARENT_THRESHOLD) { outside[left] = 1; queue.push(left); }
    const right = y * w + (w - 1);
    if (alpha[right] < TRANSPARENT_THRESHOLD) { outside[right] = 1; queue.push(right); }
  }

  // BFS flood fill
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % w;
    const y = Math.floor(idx / w);
    const neighbors = [
      y > 0 ? idx - w : -1,
      y < h - 1 ? idx + w : -1,
      x > 0 ? idx - 1 : -1,
      x < w - 1 ? idx + 1 : -1,
    ];
    for (const n of neighbors) {
      if (n >= 0 && !outside[n] && alpha[n] < TRANSPARENT_THRESHOLD) {
        outside[n] = 1;
        queue.push(n);
      }
    }
  }

  const maskData = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (outside[i]) {
      maskData[i * 4 + 3] = 0;
    } else {
      maskData[i * 4] = 255;
      maskData[i * 4 + 1] = 255;
      maskData[i * 4 + 2] = 255;
      maskData[i * 4 + 3] = 255;
    }
  }

  const mask = await sharp(maskData, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();

  shapeMaskCache.set(frameType, mask);
  return mask;
}

/**
 * Create a vignette overlay that darkens/fades portrait edges.
 * This makes the portrait blend naturally into the frame borders.
 */
function createVignette(w: number, h: number): Buffer {
  const data = Buffer.alloc(w * h * 4);

  // Inset from frame border where vignette starts
  const marginX = Math.round(w * 0.08);  // 8% from edges
  const marginY = Math.round(h * 0.06);  // 6% from edges
  const fadeWidth = Math.round(w * 0.12); // 12% fade zone

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      // Distance from the inner safe area
      const distLeft = Math.max(0, marginX - x);
      const distRight = Math.max(0, x - (w - 1 - marginX));
      const distTop = Math.max(0, marginY - y);
      const distBottom = Math.max(0, y - (h - 1 - marginY));

      const dist = Math.max(distLeft, distRight, distTop, distBottom);

      if (dist > 0) {
        // Inside fade zone: darken gradually
        const t = Math.min(1, dist / fadeWidth);
        // Darken with black overlay, increasing opacity toward edges
        const darkenAlpha = Math.round(t * t * 180); // quadratic for smooth fade
        data[idx] = 0;       // R
        data[idx + 1] = 0;   // G
        data[idx + 2] = 0;   // B
        data[idx + 3] = darkenAlpha;
      } else {
        data[idx + 3] = 0; // fully transparent in center
      }
    }
  }

  return data;
}

/**
 * Composite a DALL-E portrait with frame:
 *
 * 1. Resize portrait larger + shift down (face visible below top deco)
 * 2. Apply vignette to portrait edges (natural fade into frame)
 * 3. Clip portrait to card shape (transparent outside)
 * 4. Overlay frame decorations on top (with soft blending)
 *
 * Result: cohesive card with portrait inside, frame on top, transparent outside.
 */
export async function compositeCard(
  portraitBuffer: Buffer,
  frameType: string
): Promise<Buffer> {
  const { width, height } = CONFIG.frameDimensions;
  const { scale, yShiftPercent } = CONFIG.portraitOffset;

  // 1. Resize portrait LARGER than frame, then extract with downward offset
  const scaledW = Math.round(width * scale);
  const scaledH = Math.round(height * scale);

  const oversizedPortrait = await sharp(portraitBuffer)
    .resize(scaledW, scaledH, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .png()
    .toBuffer();

  const xOffset = Math.round((scaledW - width) / 2);
  const yOffset = Math.round(height * yShiftPercent);

  const resizedPortrait = await sharp(oversizedPortrait)
    .extract({ left: xOffset, top: yOffset, width, height })
    .png()
    .toBuffer();

  // 2. Apply vignette to portrait (darken edges for natural frame blend)
  const vignetteData = createVignette(width, height);
  const vignetteBuffer = await sharp(vignetteData, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  const vignettedPortrait = await sharp(resizedPortrait)
    .composite([{ input: vignetteBuffer, blend: 'over' }])
    .png()
    .toBuffer();

  // 3. Clip to card shape (transparent outside)
  const shapeMask = await buildShapeMask(frameType);
  const { data: maskData } = await sharp(shapeMask).raw().toBuffer({ resolveWithObject: true });
  const { data: portraitData } = await sharp(vignettedPortrait).raw().toBuffer({ resolveWithObject: true });

  const clippedData = Buffer.from(portraitData);
  for (let i = 0; i < width * height; i++) {
    if (maskData[i * 4 + 3] === 0) {
      clippedData[i * 4 + 3] = 0;
    }
  }

  const clippedPortrait = await sharp(clippedData, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  // 4. Overlay frame decorations (with soft alpha blending)
  const overlayFrame = await getOverlayFrame(frameType);

  return sharp(clippedPortrait)
    .composite([{ input: overlayFrame, top: 0, left: 0, blend: 'over' }])
    .webp({ quality: 85, effort: 4 })
    .toBuffer();
}

// Keep clipToFrameShape for backward compat
export { buildShapeMask };
export async function clipToFrameShape(cardBuffer: Buffer, frameType: string): Promise<Buffer> {
  return compositeCard(cardBuffer, frameType);
}
