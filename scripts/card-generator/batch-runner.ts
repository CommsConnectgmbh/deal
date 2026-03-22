import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';
import { processCardFromCatalog } from './generate-images';
import {
  FRAME_CONFIGS, FrameConfig,
  generateCardAttributes, buildCardCode, buildSerialDisplay,
  getTotalCardCount,
} from './frame-configs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════
// PHASE 0: Reset all image_url to NULL
// (use when switching generation approach)
// ═══════════════════════════════════════

async function resetAllImages(frameFilter?: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESET: Setting image_url to NULL`);
  console.log(`${'='.repeat(60)}\n`);

  let query = supabase
    .from('card_catalog')
    .update({ image_url: null })
    .not('image_url', 'is', null);

  if (frameFilter) {
    query = query.eq('frame', frameFilter);
    console.log(`Frame filter: ${frameFilter}`);
  }

  const { error, count } = await query.select('id', { count: 'exact', head: false });

  if (error) {
    console.error(`Reset error: ${error.message}`);
  } else {
    // Count by re-querying
    let countQuery = supabase
      .from('card_catalog')
      .select('*', { count: 'exact', head: true })
      .is('image_url', null);
    if (frameFilter) countQuery = countQuery.eq('frame', frameFilter);
    const { count: nullCount } = await countQuery;
    console.log(`Reset complete. Cards with image_url=NULL: ${nullCount}`);
  }
}

// ═══════════════════════════════════════
// PHASE 1: DB-Eintrage erstellen (ohne Bilder)
// ═══════════════════════════════════════

async function seedCatalog(configs: FrameConfig[]) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PHASE 1: Karten-Eintrage in card_catalog erstellen`);
  console.log(`${'='.repeat(60)}\n`);

  const usedCodes = new Set<string>();
  let totalInserted = 0;

  for (const config of configs) {
    // Check how many already exist for this frame
    const { count: existing } = await supabase
      .from('card_catalog')
      .select('*', { count: 'exact', head: true })
      .eq('frame', config.frame);

    if (existing && existing >= config.count) {
      console.log(`[${config.frame}] Already has ${existing}/${config.count} -> skip`);
      continue;
    }

    const startAt = (existing || 0) + 1;
    console.log(`[${config.frame}] Creating ${config.count - (existing || 0)} entries (${startAt}->${config.count})...`);

    const rows: any[] = [];

    for (let i = startAt; i <= config.count; i++) {
      let attrs;
      let cardCode: string;
      let attempts = 0;

      // Generate unique combination
      do {
        attrs = generateCardAttributes(config);
        cardCode = buildCardCode(config.frame, attrs, i);
        attempts++;
      } while (usedCodes.has(cardCode) && attempts < 100);

      usedCodes.add(cardCode);

      rows.push({
        frame: config.frame,
        rarity: config.rarity,
        gender: attrs.gender,
        origin: attrs.origin,
        hair: attrs.hair,
        style: attrs.style,
        accessory: attrs.accessory,
        effect: attrs.effect,
        card_code: cardCode,
        serial_number: i,
        serial_display: buildSerialDisplay(config.rarity, i, config.count),
        image_url: null,
        is_claimed: false,
        is_available: config.rarity !== 'event', // Event cards start unavailable
      });
    }

    // Batch insert (max 100 per request)
    for (let batch = 0; batch < rows.length; batch += 100) {
      const chunk = rows.slice(batch, batch + 100);
      const { error } = await supabase.from('card_catalog').insert(chunk);
      if (error) {
        console.error(`  INSERT ERROR: ${error.message}`);
        // Try one by one for duplicates
        for (const row of chunk) {
          const { error: singleErr } = await supabase.from('card_catalog').insert(row);
          if (singleErr && !singleErr.message.includes('duplicate')) {
            console.error(`  SKIP ${row.card_code}: ${singleErr.message}`);
          } else if (!singleErr) {
            totalInserted++;
          }
        }
      } else {
        totalInserted += chunk.length;
      }
    }

    console.log(`  Done: ${rows.length} entries for ${config.frame}`);
  }

  console.log(`\nPhase 1 done: ${totalInserted} new entries\n`);
  return totalInserted;
}

// ═══════════════════════════════════════
// PHASE 2: Bilder generieren fur Eintrage ohne image_url
// ═══════════════════════════════════════

async function generateImages(frameFilter?: string, limit?: number) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PHASE 2: Bilder generieren (FULL-CARD: DALL-E 3 generiert komplette Karte)`);
  console.log(`Model: ${CONFIG.dalle.model} | ${CONFIG.dalle.size}`);
  console.log(`${'='.repeat(60)}\n`);

  // Count remaining
  let query = supabase
    .from('card_catalog')
    .select('*', { count: 'exact', head: true })
    .is('image_url', null);
  if (frameFilter) query = query.eq('frame', frameFilter);
  const { count: totalRemaining } = await query;

  const effectiveLimit = limit || totalRemaining || 0;
  const toGenerate = Math.min(effectiveLimit, totalRemaining || 0);

  console.log(`Cards without images: ${totalRemaining}`);
  console.log(`Will generate: ${toGenerate}`);
  console.log(`Estimated cost: $${(toGenerate * CONFIG.costPerImage).toFixed(2)} (@ $${CONFIG.costPerImage}/image)`);
  console.log(`Estimated time: ~${Math.round(toGenerate * 15 / 60)} minutes`);
  console.log();

  if (toGenerate === 0) {
    console.log('Nothing to generate!');
    return;
  }

  let totalProcessed = 0;
  let totalFailed = 0;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 5;
  const startTime = Date.now();

  // Process in priority order from FRAME_CONFIGS
  const frameOrder = FRAME_CONFIGS.map(c => c.frame);

  for (const frame of frameOrder) {
    if (frameFilter && frame !== frameFilter) continue;
    if (totalProcessed >= effectiveLimit) break;

    let hasMore = true;

    while (hasMore && totalProcessed < effectiveLimit) {
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`\n[ABORT] ${MAX_CONSECUTIVE_FAILURES} consecutive failures. Stopping.`);
        hasMore = false;
        break;
      }

      const batchLimit = Math.min(CONFIG.rateLimit.batchSize, effectiveLimit - totalProcessed);
      const { data: cards, error } = await supabase
        .from('card_catalog')
        .select('card_code, frame, rarity, gender, origin, hair, style, accessory, effect')
        .eq('frame', frame)
        .is('image_url', null)
        .limit(batchLimit);

      if (error) {
        console.error(`DB error: ${error.message}`);
        break;
      }

      if (!cards || cards.length === 0) {
        hasMore = false;
        break;
      }

      // Process batch
      for (const card of cards) {
        const success = await processCardFromCatalog(card);
        if (success) {
          totalProcessed++;
          consecutiveFailures = 0;
        } else {
          totalFailed++;
          consecutiveFailures++;
        }

        // Rate limit pause between requests
        if (cards.indexOf(card) < cards.length - 1) {
          console.log(`  Waiting ${CONFIG.rateLimit.pauseBetweenRequests / 1000}s...`);
          await sleep(CONFIG.rateLimit.pauseBetweenRequests);
        }
      }

      // Batch status
      const elapsed = Math.round((Date.now() - startTime) / 60000);
      const remaining = effectiveLimit - totalProcessed;
      const estMin = Math.round(remaining * 8 / 60);

      console.log(`\n${'─'.repeat(50)}`);
      console.log(`  Progress: ${totalProcessed}/${toGenerate} done, ${totalFailed} failed`);
      console.log(`  Runtime: ${elapsed} min | Remaining: ~${remaining} cards (~${estMin} min)`);
      console.log(`  Cost so far: ~$${(totalProcessed * CONFIG.costPerImage).toFixed(2)}`);
      console.log(`${'─'.repeat(50)}`);

      // Pause between batches
      if (cards.length >= CONFIG.rateLimit.batchSize && totalProcessed < effectiveLimit) {
        console.log(`  Batch pause ${CONFIG.rateLimit.pauseBetweenBatches / 1000}s...\n`);
        await sleep(CONFIG.rateLimit.pauseBetweenBatches);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`FINISHED!`);
  console.log(`Generated: ${totalProcessed} cards`);
  console.log(`Failed: ${totalFailed} cards`);
  console.log(`Total cost: ~$${(totalProcessed * CONFIG.costPerImage).toFixed(2)}`);
  console.log(`Duration: ${Math.round((Date.now() - startTime) / 60000)} min`);
  console.log(`${'='.repeat(60)}`);
}

// ═══════════════════════════════════════
// CLI
// ═══════════════════════════════════════
// npx tsx batch-runner.ts seed              -> Phase 1: DB-Eintrage
// npx tsx batch-runner.ts generate          -> Phase 2: Bilder
// npx tsx batch-runner.ts all               -> Phase 1 + 2
// npx tsx batch-runner.ts reset             -> Reset all image_url to NULL
// npx tsx batch-runner.ts generate --frame bronze --limit 2   (test)

const args = process.argv.slice(2);
const command = args[0] || 'all';
let frameArg: string | undefined;
let limitArg: number | undefined;

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--frame' && args[i + 1]) {
    frameArg = args[i + 1];
    i++;
  } else if (args[i] === '--limit' && args[i + 1]) {
    limitArg = parseInt(args[i + 1], 10);
    i++;
  }
}

async function main() {
  const total = getTotalCardCount();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`DEALBUDDY CARD CATALOG GENERATOR`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total configured: ${total} cards across ${FRAME_CONFIGS.length} frame types`);
  console.log(`Command: ${command}`);
  console.log(`Mode: FULL-CARD (DALL-E 3 generiert komplette Karte inkl. Rahmen)`);
  console.log(`Model: ${CONFIG.dalle.model} | Size: ${CONFIG.dalle.size}`);
  console.log(`Cost per image: $${CONFIG.costPerImage}`);
  if (frameArg) console.log(`Frame filter: ${frameArg}`);
  if (limitArg) console.log(`Limit: ${limitArg}`);
  console.log(`${'='.repeat(60)}`);

  const configs = frameArg
    ? FRAME_CONFIGS.filter(c => c.frame === frameArg)
    : FRAME_CONFIGS;

  if (command === 'reset') {
    await resetAllImages(frameArg);
    return;
  }

  if (command === 'seed' || command === 'all') {
    await seedCatalog(configs);
  }

  if (command === 'generate' || command === 'all') {
    await generateImages(frameArg, limitArg);
  }

  if (!['seed', 'generate', 'all', 'reset'].includes(command)) {
    console.log(`\nUsage:`);
    console.log(`  npx tsx batch-runner.ts seed              -> Create DB entries`);
    console.log(`  npx tsx batch-runner.ts generate          -> Generate card images`);
    console.log(`  npx tsx batch-runner.ts all               -> Both seed + generate`);
    console.log(`  npx tsx batch-runner.ts reset             -> Reset all image_url to NULL`);
    console.log(`\nOptions:`);
    console.log(`  --frame bronze    Filter by frame type`);
    console.log(`  --limit 2         Limit number of cards to generate`);
    console.log(`\nExamples:`);
    console.log(`  npx tsx batch-runner.ts generate --frame gold --limit 2    (test 2 gold cards)`);
    console.log(`  npx tsx batch-runner.ts reset --frame bronze               (reset only bronze)`);
    console.log(`  npx tsx batch-runner.ts generate                           (generate all missing)`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
