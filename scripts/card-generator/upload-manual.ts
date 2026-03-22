/**
 * Upload manually generated images to Supabase Storage.
 * Place images in generated-images/{rarity}/{cardId}.png
 * then run: npx tsx upload-manual.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from './config';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function uploadManualImages(rarity?: string) {
  const baseDir = CONFIG.localImageDir;
  const rarities = rarity
    ? [rarity]
    : fs.readdirSync(baseDir).filter(f =>
        fs.statSync(path.join(baseDir, f)).isDirectory()
      );

  let uploaded = 0;
  let failed = 0;

  for (const r of rarities) {
    const dir = path.join(baseDir, r);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
    console.log(`[${r}] Found ${files.length} images to upload`);

    for (const file of files) {
      const cardId = path.basename(file, '.png');
      const filePath = path.join(dir, file);
      const imageBuffer = fs.readFileSync(filePath);
      const storagePath = `${r}/${file}`;

      try {
        const { error } = await supabase.storage
          .from(CONFIG.storage.bucket)
          .upload(storagePath, imageBuffer, {
            contentType: 'image/png',
            cacheControl: '31536000',
            upsert: true,
          });

        if (error) throw error;

        const { data } = supabase.storage
          .from(CONFIG.storage.bucket)
          .getPublicUrl(storagePath);

        const { error: dbError } = await supabase
          .from('card_templates')
          .update({ image_url: data.publicUrl })
          .eq('id', cardId);

        if (dbError) throw dbError;

        uploaded++;
        console.log(`  [OK] ${cardId}`);
      } catch (err: any) {
        failed++;
        console.error(`  [FAIL] ${cardId}: ${err.message}`);
      }
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${failed} failed`);
}

const rarityArg = process.argv[2];
uploadManualImages(rarityArg).catch(console.error);
