/**
 * generate-images.ts — FULL-CARD APPROACH
 *
 * DALL-E 3 generates the COMPLETE trading card (frame + character + background)
 * in a single 1024x1792 image. No compositing needed.
 *
 * Pipeline: DALL-E 3 → WebP → save locally → upload to Supabase → update DB
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from './config';
import { buildCardPrompt, CardTraits } from './prompt-builder';

let _openai: OpenAI;
let _supabase: ReturnType<typeof createClient>;

function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function getSupabase() {
  if (!_supabase) _supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return _supabase;
}

/** Generate complete card via DALL-E 3 (frame + character + background) */
async function generateFullCard(prompt: string): Promise<Buffer> {
  const response = await getOpenAI().images.generate({
    model: CONFIG.dalle.model,
    prompt,
    n: 1,
    size: CONFIG.dalle.size,
    quality: CONFIG.dalle.quality,
    style: CONFIG.dalle.style,
    response_format: 'b64_json',
  });

  const b64 = response.data[0].b64_json!;
  return Buffer.from(b64, 'base64');
}

/**
 * Post-process: trim dark borders DALL-E adds, then resize to exact card dimensions.
 * DALL-E 3 often renders the card with a dark background around it — we remove that.
 */
async function trimAndResize(buffer: Buffer): Promise<Buffer> {
  // Step 1: Trim dark borders (threshold=15 catches near-black backgrounds)
  const trimmed = await sharp(buffer)
    .trim({ background: '#000000', threshold: 30 })
    .toBuffer();

  // Step 2: Resize to exact card dimensions (1024x1792) with cover to fill
  const resized = await sharp(trimmed)
    .resize(CONFIG.canvasWidth, CONFIG.canvasHeight, { fit: 'cover' })
    .png()
    .toBuffer();

  return resized;
}

async function convertToWebP(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).webp({ quality: 90, effort: 4 }).toBuffer();
}

function saveLocally(imageBuffer: Buffer, cardCode: string, rarity: string, frame: string): string {
  const dir = path.join(CONFIG.localImageDir, rarity, frame);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${cardCode}.webp`);
  fs.writeFileSync(filePath, imageBuffer);
  return filePath;
}

async function uploadToStorage(
  imageBuffer: Buffer, cardCode: string, rarity: string, frame: string
): Promise<string> {
  const storagePath = `cards/${rarity}/${frame}/${cardCode}.webp`;

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= CONFIG.storage.maxRetries; attempt++) {
    const { error } = await getSupabase().storage
      .from(CONFIG.storage.bucket)
      .upload(storagePath, imageBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      });

    if (!error) {
      const { data } = getSupabase().storage
        .from(CONFIG.storage.bucket)
        .getPublicUrl(storagePath);
      return data.publicUrl;
    }

    lastError = new Error(error.message);
    if (attempt < CONFIG.storage.maxRetries) {
      console.log(`  Upload retry ${attempt}/${CONFIG.storage.maxRetries}...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error(`Storage upload failed: ${lastError?.message}`);
}

async function updateImageUrl(cardCode: string, imageUrl: string): Promise<void> {
  const { error } = await getSupabase()
    .from('card_catalog')
    .update({ image_url: imageUrl })
    .eq('card_code', cardCode);
  if (error) throw new Error(`DB update failed: ${error.message}`);
}

/**
 * Process a single card — FULL-CARD APPROACH:
 * 1. DALL-E 3 generates complete card (frame + character + background)
 * 2. Convert to WebP, save + upload + update DB
 */
export async function processCardFromCatalog(card: {
  card_code: string;
  frame: string;
  rarity: string;
  gender: string;
  origin: string;
  hair: string;
  style: string;
  accessory: string;
  effect: string;
}): Promise<boolean> {
  try {
    const shortCode = card.card_code.substring(0, 45);
    console.log(`\n[${card.rarity}/${card.frame}] ${shortCode}`);

    const traits: CardTraits = {
      id: card.card_code,
      frame_type: card.frame,
      rarity: card.rarity,
      gender: card.gender,
      origin: card.origin,
      hair: card.hair,
      style: card.style,
      accessory: card.accessory,
      effect: card.effect,
    };

    // 1. Build full-card prompt (frame + character + background)
    const prompt = buildCardPrompt(traits);

    // 2. Generate COMPLETE card via DALL-E 3 (1024x1792)
    console.log(`  Generating full card (DALL-E 3, ${CONFIG.dalle.size})...`);
    const cardPng = await generateFullCard(prompt);
    console.log(`  Card: ${(cardPng.length / 1024).toFixed(0)}KB`);

    // 3. Trim dark borders + resize to exact card dimensions
    console.log(`  Trimming & resizing to ${CONFIG.canvasWidth}x${CONFIG.canvasHeight}...`);
    const processedPng = await trimAndResize(cardPng);

    // 4. Convert to WebP
    const webpBuffer = await convertToWebP(processedPng);
    console.log(`  WebP: ${(webpBuffer.length / 1024).toFixed(0)}KB`);

    // 5. Save locally
    const localPath = saveLocally(webpBuffer, card.card_code, card.rarity, card.frame);
    console.log(`  Saved: ${localPath}`);

    // 6. Upload
    const publicUrl = await uploadToStorage(
      webpBuffer, card.card_code, card.rarity, card.frame
    );
    console.log(`  Uploaded`);

    // 7. Update DB
    await updateImageUrl(card.card_code, publicUrl);

    console.log(`  [OK] Complete!`);
    return true;
  } catch (error: any) {
    const shortCode = card.card_code.substring(0, 45);
    console.error(`  [FAIL] ${shortCode}: ${error.message}`);
    return false;
  }
}

export { generateFullCard, uploadToStorage, updateImageUrl, getSupabase };
