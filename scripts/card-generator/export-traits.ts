import { createClient } from '@supabase/supabase-js';
import { buildPromptWithMetadata, CardTraits } from './prompt-builder';
import * as fs from 'fs';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function exportTraits(rarity?: string) {
  let query = supabase
    .from('card_templates')
    .select('id, frame_type, rarity, gender, origin, hair, style, accessory, effect')
    .eq('is_user_avatar', false)
    .is('image_url', null);

  if (rarity) query = query.eq('rarity', rarity);

  const { data, error } = await query;
  if (error) throw error;

  const cards = data as CardTraits[];
  const prompts = cards.map(card => buildPromptWithMetadata(card));

  // JSON export
  const jsonFile = `card-prompts${rarity ? `-${rarity}` : ''}.json`;
  fs.writeFileSync(jsonFile, JSON.stringify(prompts, null, 2));
  console.log(`Exported ${prompts.length} prompts to ${jsonFile}`);

  // Plain text export (for manual ChatGPT use)
  const textContent = prompts.map((p, i) =>
    `--- Card ${i + 1} (${p.rarity}/${p.frame}) [${p.card_id.substring(0, 8)}] ---\n${p.prompt}\n`
  ).join('\n');

  const txtFile = `card-prompts${rarity ? `-${rarity}` : ''}.txt`;
  fs.writeFileSync(txtFile, textContent);
  console.log(`Exported prompt list to ${txtFile}`);
}

const rarityArg = process.argv[2];
exportTraits(rarityArg).catch(console.error);
