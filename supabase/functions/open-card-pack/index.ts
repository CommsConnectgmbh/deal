// Supabase Edge Function: open-card-pack
// Opens a card pack with weighted RNG, claiming cards from card_catalog
// Returns RevealCard[] for the PackReveal component

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Frame tier → name mapping for display
const FRAME_NAMES: Record<string, string> = {
  bronze: 'Bronze', silver: 'Silber', gold: 'Gold',
  emerald: 'Smaragd', sapphire: 'Saphir', ruby: 'Rubin',
  topaz: 'Topas', obsidian: 'Obsidian', founder: 'Founder',
}

// Dust rewards for duplicate cards by rarity
const DUPLICATE_DUST: Record<string, number> = {
  common: 15, rare: 35, epic: 75, legendary: 200, founder: 300, event: 150,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Auth ──────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: corsHeaders })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // ── Rate limit: max 20 pack opens per hour ────────────────────
    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentOpens } = await supabase
      .from('pack_purchases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('purchased_at', since1h)

    if ((recentOpens || 0) >= 20) {
      return new Response(JSON.stringify({ error: 'Rate limit: max 20 packs per hour' }), { status: 429, headers: corsHeaders })
    }

    // ── Parse request ─────────────────────────────────────────────
    const { pack_id } = await req.json()
    if (!pack_id) {
      return new Response(JSON.stringify({ error: 'Missing pack_id' }), { status: 400, headers: corsHeaders })
    }

    // ── Fetch pack definition ─────────────────────────────────────
    const { data: pack, error: packError } = await supabase
      .from('pack_definitions')
      .select('*')
      .eq('id', pack_id)
      .eq('is_active', true)
      .single()

    if (packError || !pack) {
      return new Response(JSON.stringify({ error: 'Pack not found' }), { status: 404, headers: corsHeaders })
    }

    // ── Check coin balance (pre-check) ────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', user.id)
      .single()

    if (!profile || profile.coins < pack.price_coins) {
      return new Response(JSON.stringify({
        error: 'Not enough coins',
        required: pack.price_coins,
        current: profile?.coins || 0,
      }), { status: 400, headers: corsHeaders })
    }

    // ── Fetch loot table for this pack ────────────────────────────
    const { data: lootTable } = await supabase
      .from('card_pack_loot_table')
      .select('*')
      .eq('pack_id', pack_id)

    if (!lootTable || lootTable.length === 0) {
      return new Response(JSON.stringify({ error: 'No loot table for this pack' }), { status: 500, headers: corsHeaders })
    }

    // ── Atomic coin deduction ─────────────────────────────────────
    const { error: deductError } = await supabase.rpc('deduct_coins', {
      p_user_id: user.id,
      p_amount: pack.price_coins,
    })

    if (deductError) {
      return new Response(JSON.stringify({
        error: deductError.message?.includes('Insufficient') ? 'Not enough coins' : deductError.message,
      }), { status: 400, headers: corsHeaders })
    }

    // Log wallet deduction
    await supabase.from('wallet_ledger').insert({
      user_id: user.id,
      delta: -pack.price_coins,
      reason: 'card_pack_purchase',
      reference_id: pack_id,
    })

    // ── Get user's existing cards to detect duplicates ─────────────
    const { data: existingCards } = await supabase
      .from('user_cards')
      .select('card_id')
      .eq('user_id', user.id)

    const ownedCardIds = new Set((existingCards || []).map(c => c.card_id))

    // ── Load user DNA for card matching ──────────────────────────
    const { data: userDna } = await supabase
      .from('user_avatar_dna')
      .select('gender, origin, hair, age')
      .eq('user_id', user.id)
      .single()

    // Fallback: if no DNA set yet, skip filtering (legacy users)
    const dnaGender = userDna?.gender || null
    const dnaAge = userDna?.age || null

    // ── Roll cards ────────────────────────────────────────────────
    const totalWeight = lootTable.reduce((sum: number, l: any) => sum + l.weight, 0)
    const cards: any[] = []
    let totalDust = 0
    let guaranteeEpic = pack.pack_type === 'elite' // Elite pack guarantees at least 1 epic

    for (let i = 0; i < pack.cards_per_pack; i++) {
      // For elite packs: last card is guaranteed epic+ if none rolled yet
      let rolledRarity: string

      if (guaranteeEpic && i === pack.cards_per_pack - 1) {
        // Check if we already rolled an epic+ card
        const hasEpicPlus = cards.some(c => ['epic', 'legendary', 'founder', 'event'].includes(c.rarity))
        if (!hasEpicPlus) {
          // Force epic or better
          const epicEntries = lootTable.filter((l: any) =>
            ['epic', 'legendary', 'founder', 'event'].includes(l.rarity)
          )
          if (epicEntries.length > 0) {
            const epicWeight = epicEntries.reduce((sum: number, l: any) => sum + l.weight, 0)
            let epicRoll = Math.random() * epicWeight
            rolledRarity = epicEntries[0].rarity
            for (const entry of epicEntries) {
              epicRoll -= entry.weight
              if (epicRoll <= 0) { rolledRarity = entry.rarity; break }
            }
          } else {
            rolledRarity = 'epic' // Fallback
          }
        } else {
          // Normal roll
          rolledRarity = rollRarity(lootTable, totalWeight)
        }
      } else {
        rolledRarity = rollRarity(lootTable, totalWeight)
      }

      // Find an available (unclaimed) card of this rarity — DNA-matched
      // Fallback hierarchy: gender+age → gender only → any card
      let card: any = null

      // Helper: try to claim a card from a filtered query
      const tryClaimFromQuery = async (query: any): Promise<any> => {
        const { data: candidates } = await query
          .eq('is_claimed', false)
          .eq('is_available', true)
          .limit(5)

        if (!candidates || candidates.length === 0) return null

        // Pick random candidate from results
        const shuffled = candidates.sort(() => Math.random() - 0.5)
        for (const candidate of shuffled) {
          const { data: updated, error: claimErr } = await supabase
            .from('card_catalog')
            .update({ is_claimed: true })
            .eq('id', candidate.id)
            .eq('is_claimed', false) // Atomic: only succeeds if still unclaimed
            .select()

          if (!claimErr && updated && updated.length > 0) return updated[0]
        }
        return null
      }

      // Tier 1: Exact match — gender + age + rarity
      if (dnaGender && dnaAge) {
        card = await tryClaimFromQuery(
          supabase.from('card_catalog').select('*')
            .eq('rarity', rolledRarity)
            .eq('gender', dnaGender)
            .eq('age', dnaAge)
        )
      }

      // Tier 2: Gender only
      if (!card && dnaGender) {
        card = await tryClaimFromQuery(
          supabase.from('card_catalog').select('*')
            .eq('rarity', rolledRarity)
            .eq('gender', dnaGender)
        )
      }

      // Tier 3: Any unclaimed card of this rarity (fallback)
      if (!card) {
        card = await tryClaimFromQuery(
          supabase.from('card_catalog').select('*')
            .eq('rarity', rolledRarity)
        )
      }

      if (card) {
        const isDuplicate = ownedCardIds.has(card.id)
        let dustEarned = 0

        if (isDuplicate) {
          // Duplicate: give dust (coins) instead
          dustEarned = DUPLICATE_DUST[card.rarity] || 25
          totalDust += dustEarned
        } else {
          // Card already claimed atomically above, just insert into user_cards
          await supabase.from('user_cards').insert({
            user_id: user.id,
            card_id: card.id,
            is_equipped: false,
            obtained_from: 'pack',
          })

          ownedCardIds.add(card.id)
        }

        cards.push({
          template_id: card.id,
          name: buildCardName(card),
          description: `${card.gender} · ${card.origin} · ${card.style}`,
          rarity: card.rarity,
          frame_type: card.frame,
          image_url: card.image_url || null,
          is_new: !isDuplicate,
          dust_earned: dustEarned,
          serial_number: card.serial_display || null,
        })
      } else {
        // No cards available at this rarity — give dust (coins)
        const lootEntry = lootTable.find((l: any) => l.rarity === rolledRarity)
        const dustAmount = lootEntry?.dust_if_unavailable || 50
        totalDust += dustAmount

        cards.push({
          template_id: `dust_${i}`,
          name: `${dustAmount} Dust`,
          description: 'Keine Karten dieser Seltenheit verfugbar',
          rarity: rolledRarity,
          frame_type: 'bronze',
          image_url: null,
          is_new: false,
          dust_earned: dustAmount,
          serial_number: null,
        })
      } // end if card / else
    } // end for loop

    // ── Award dust as coins ───────────────────────────────────────
    if (totalDust > 0) {
      await supabase.rpc('add_coins', { p_user_id: user.id, p_amount: totalDust })
      await supabase.from('wallet_ledger').insert({
        user_id: user.id,
        delta: totalDust,
        reason: 'card_dust_refund',
        reference_id: pack_id,
      })
    }

    // ── Log purchase ──────────────────────────────────────────────
    await supabase.from('pack_purchases').insert({
      user_id: user.id,
      pack_id,
      cards_received: cards.map(c => ({
        template_id: c.template_id,
        rarity: c.rarity,
        is_new: c.is_new,
        dust_earned: c.dust_earned,
      })),
      coins_spent: pack.price_coins,
      dust_earned: totalDust,
    })

    // ── Get updated balance ───────────────────────────────────────
    const { data: updatedProfile } = await supabase
      .from('profiles').select('coins').eq('id', user.id).single()

    return new Response(JSON.stringify({
      success: true,
      cards,
      new_balance: updatedProfile?.coins ?? 0,
      dust_earned: totalDust,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('open-card-pack error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})

// ── Helper: Weighted RNG ──────────────────────────────────────────
function rollRarity(lootTable: any[], totalWeight: number): string {
  let roll = Math.random() * totalWeight
  let picked = lootTable[0]
  for (const entry of lootTable) {
    roll -= entry.weight
    if (roll <= 0) { picked = entry; break }
  }
  return picked.rarity
}

// ── Helper: Build card name from attributes ───────────────────────
function buildCardName(card: any): string {
  const frameName = FRAME_NAMES[card.frame] || card.frame
  const archetype = card.archetype
    ? card.archetype.charAt(0).toUpperCase() + card.archetype.slice(1)
    : null
  if (archetype) return `${archetype} ${frameName}`
  return `${frameName} Karte`
}
