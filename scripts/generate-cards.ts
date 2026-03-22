/**
 * Card Generation Script
 * Generates ~8,290 collectible card templates + instances
 *
 * Usage:
 *   npx tsx scripts/generate-cards.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL
 * in .env.local (already configured).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

/* ── Trait pools ──────────────────────────────────────── */

const GENDERS = ['male', 'female']
const ORIGINS = ['european', 'african', 'east_asian', 'south_asian', 'latin', 'middle_eastern']
const HAIRS = ['short', 'long', 'curly', 'buzz', 'ponytail', 'braided']
const STYLES = [
  'business_suit', 'luxury_blazer', 'streetwear_hoodie',
  'tech_founder', 'cyberpunk_jacket', 'fantasy_armor',
]
const ACCESSORIES = ['none', 'glasses', 'gold_chain', 'watch', 'earrings']
const EFFECTS = ['none', 'glow', 'particles', 'lightning', 'fire', 'ice', 'rainbow', 'holographic']

/* ── Frame distribution (from spec) ──────────────────── */
// frame_type -> { count, rarity, hasSerial, effectChance }

interface FrameSpec {
  frame_type: string
  count: number
  rarity: string
  hasSerial: boolean
  effectChance: number // 0-1 chance of having a non-"none" effect
}

const FRAME_SPECS: FrameSpec[] = [
  // Common (no serial)
  { frame_type: 'bronze',   count: 2000, rarity: 'common',    hasSerial: false, effectChance: 0 },
  { frame_type: 'silver',   count: 2000, rarity: 'common',    hasSerial: false, effectChance: 0 },
  // Rare (no serial)
  { frame_type: 'gold',     count: 1200, rarity: 'rare',      hasSerial: false, effectChance: 0.1 },
  // Epic (serial #001-#400)
  { frame_type: 'emerald',  count: 400,  rarity: 'epic',      hasSerial: true,  effectChance: 0.3 },
  { frame_type: 'sapphire', count: 400,  rarity: 'epic',      hasSerial: true,  effectChance: 0.3 },
  { frame_type: 'ruby',     count: 400,  rarity: 'epic',      hasSerial: true,  effectChance: 0.3 },
  { frame_type: 'amethyst', count: 400,  rarity: 'epic',      hasSerial: true,  effectChance: 0.3 },
  { frame_type: 'topaz',    count: 400,  rarity: 'epic',      hasSerial: true,  effectChance: 0.3 },
  // Legendary (serial)
  { frame_type: 'legend',   count: 150,  rarity: 'legendary',  hasSerial: true,  effectChance: 1.0 },
  { frame_type: 'icon',     count: 120,  rarity: 'legendary',  hasSerial: true,  effectChance: 1.0 },
  { frame_type: 'obsidian', count: 80,   rarity: 'legendary',  hasSerial: true,  effectChance: 1.0 },
  // Founder (serial #001/050)
  { frame_type: 'founder',  count: 50,   rarity: 'founder',    hasSerial: true,  effectChance: 1.0 },
  { frame_type: 'hero',     count: 50,   rarity: 'founder',    hasSerial: true,  effectChance: 1.0 },
  // Event (serial)
  { frame_type: 'futties',            count: 150,  rarity: 'event', hasSerial: true,  effectChance: 0.5 },
  { frame_type: 'neon',               count: 150,  rarity: 'event', hasSerial: true,  effectChance: 0.5 },
  { frame_type: 'celestial',          count: 120,  rarity: 'event', hasSerial: true,  effectChance: 0.5 },
  { frame_type: 'player_of_the_week', count: 120,  rarity: 'event', hasSerial: true,  effectChance: 0.5 },
]

/* ── Helpers ──────────────────────────────────────────── */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomEffect(chance: number): string {
  if (Math.random() > chance) return 'none'
  const nonNone = EFFECTS.filter(e => e !== 'none')
  return pick(nonNone)
}

function padSerial(n: number, total: number): string {
  const digits = String(total).length
  return `#${String(n).padStart(digits, '0')}/${String(total).padStart(digits, '0')}`
}

/* ── Main ─────────────────────────────────────────────── */

async function main() {
  const totalCards = FRAME_SPECS.reduce((sum, s) => sum + s.count, 0)
  console.log(`Generating ${totalCards} collectible cards...\n`)

  let totalInserted = 0

  for (const spec of FRAME_SPECS) {
    console.log(`  ${spec.frame_type} (${spec.rarity}): ${spec.count} cards...`)

    // Build template + instance rows in batches of 500
    const BATCH_SIZE = 500
    for (let batchStart = 0; batchStart < spec.count; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, spec.count)
      const templates: any[] = []

      for (let i = batchStart; i < batchEnd; i++) {
        templates.push({
          frame_type: spec.frame_type,
          rarity: spec.rarity,
          gender: pick(GENDERS),
          origin: pick(ORIGINS),
          hair: pick(HAIRS),
          style: pick(STYLES),
          accessory: pick(ACCESSORIES),
          effect: randomEffect(spec.effectChance),
          image_url: null,
          is_user_avatar: false,
          owner_user_id: null,
          season: 1,
          is_limited: spec.rarity === 'founder' || spec.rarity === 'event',
        })
      }

      // Insert templates
      const { data: insertedTemplates, error: tplErr } = await supabase
        .from('card_templates')
        .insert(templates)
        .select('id')

      if (tplErr) {
        console.error(`  ERROR inserting templates for ${spec.frame_type}:`, tplErr.message)
        continue
      }

      if (!insertedTemplates || insertedTemplates.length === 0) {
        console.error(`  ERROR: No templates returned for ${spec.frame_type}`)
        continue
      }

      // Create instances for each template
      const instances = insertedTemplates.map((tpl, idx) => ({
        card_template_id: tpl.id,
        serial_number: spec.hasSerial ? padSerial(batchStart + idx + 1, spec.count) : null,
        is_claimed: false,
        claimed_at: null,
      }))

      const { error: instErr } = await supabase
        .from('card_instances')
        .insert(instances)

      if (instErr) {
        console.error(`  ERROR inserting instances for ${spec.frame_type}:`, instErr.message)
        continue
      }

      totalInserted += insertedTemplates.length
    }

    console.log(`    Done.`)
  }

  console.log(`\nTotal cards generated: ${totalInserted}`)

  // Verify counts
  const { count: templateCount } = await supabase
    .from('card_templates')
    .select('*', { count: 'exact', head: true })
    .eq('is_user_avatar', false)

  const { count: instanceCount } = await supabase
    .from('card_instances')
    .select('*', { count: 'exact', head: true })
    .eq('is_claimed', false)

  console.log(`\nVerification:`)
  console.log(`  Card templates (collectible): ${templateCount}`)
  console.log(`  Card instances (unclaimed):   ${instanceCount}`)
  console.log(`\nDone!`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
