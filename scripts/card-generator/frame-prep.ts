import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { CONFIG } from './config';

// Cache upscaled frames and masks
const frameCache = new Map<string, Buffer>();
const maskCache = new Map<string, Buffer>();

/**
 * Load and upscale a frame to the output size (1024x1536).
 * Also makes dark interior pixels opaque black (clean base for inpainting).
 */
export async function getUpscaledFrame(frameType: string): Promise<Buffer> {
  if (frameCache.has(frameType)) return frameCache.get(frameType)!;

  const fileName = CONFIG.frameFiles[frameType];
  if (!fileName) throw new Error(`No frame file for: "${frameType}"`);

  const framePath = path.join(CONFIG.frameDir, fileName);
  if (!fs.existsSync(framePath)) throw new Error(`Frame not found: ${framePath}`);

  const { width, height } = CONFIG.outputSize;

  // Upscale frame to 1024x1536
  const upscaled = await sharp(framePath)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();

  frameCache.set(frameType, upscaled);
  return upscaled;
}

/**
 * Create an edit mask for the frame.
 * - Opaque (white, alpha=255) = keep original frame
 * - Transparent (alpha=0) = area for AI to generate avatar
 *
 * The edit zone is a rectangle in the center of the card
 * where the portrait should go.
 */
export async function getEditMask(frameType: string): Promise<Buffer> {
  if (maskCache.has(frameType)) return maskCache.get(frameType)!;

  const { width, height } = CONFIG.outputSize;
  const ez = CONFIG.editZone;

  // Create raw RGBA buffer: start fully opaque white
  const maskData = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    maskData[i * 4] = 255;     // R
    maskData[i * 4 + 1] = 255; // G
    maskData[i * 4 + 2] = 255; // B
    maskData[i * 4 + 3] = 255; // A = opaque (keep)
  }

  // Cut transparent rectangle in center (edit zone for avatar)
  for (let y = ez.y; y < ez.y + ez.height && y < height; y++) {
    for (let x = ez.x; x < ez.x + ez.width && x < width; x++) {
      const idx = (y * width + x) * 4;
      maskData[idx] = 0;       // R
      maskData[idx + 1] = 0;   // G
      maskData[idx + 2] = 0;   // B
      maskData[idx + 3] = 0;   // A = transparent (edit zone)
    }
  }

  const maskBuffer = await sharp(maskData, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  maskCache.set(frameType, maskBuffer);
  return maskBuffer;
}
