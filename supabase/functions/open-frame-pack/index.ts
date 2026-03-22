// Supabase Edge Function: open-frame-pack
// Opens a frame pack with weighted RNG, pity logic, and duplicate handling
// V11 Store Redesign

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Pity thresholds: after N opens without a high-tier frame, guarantee one
const PITY_CONFIG: Record<string, { threshold: number; guaranteeMinTier: string }> = {
  pro:    { threshold: 10, guaranteeMinTier: 'ruby' },
  legend: { threshold: 10, guaranteeMinTier: 'topaz' },
}

// Frame tier ordering for pity checks
const FRAME_TIER_ORDER = ['bronze','silver','gold','emerald','sapphire','ruby','topaz','obsidian']

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: corsHeaders })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // Rate limit: max 20 pack opens per hour
    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentOpens } = await supabase
      .from('user_pack_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('opened_at', since1h)

    if ((recentOpens || 0) >= 20) {
      return new Response(JSON.stringify({ error: 'Rate limit: max 20 packs per hour' }), { status: 429, headers: corsHeaders })
    }

    const { pack_id } = await req.json()
    if (!pack_id) {
      return new Response(JSON.stringify({ error: 'Missing pack_id' }), { status: 400, headers: corsHeaders })
    }

    // Fetch pack definition
    const { data: pack, error: packError } = await supabase
      .from('frame_packs')
      .select('*')
      .eq('id', pack_id)
      .eq('is_active', true)
      .single()

    if (packError || !pack) {
      return new Response(JSON.stringify({ error: 'Pack not found' }), { status: 404, headers: corsHeaders })
    }

    // Check event pack availability
    if (pack_id === 'event') {
      const { data: activeEvents } = await supabase
        .from('events')
        .select('id')
        .eq('is_active', true)
        .lte('starts_at', new Date().toISOString())
        .gte('ends_at', new Date().toISOString())
      if (!activeEvents || activeEvents.length === 0) {
        return new Response(JSON.stringify({ error: 'No active event — Event Pack unavailable' }), { status: 400, headers: corsHeaders })
      }
    }

    // Check user has enough coins (pre-check for UX, actual deduction is atomic below)
    const { data: profile } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', user.id)
      .single()

    if (!profile || profile.coins < pack.coin_price) {
      return new Response(JSON.stringify({ error: 'Not enough coins', required: pack.coin_price, current: profile?.coins || 0 }), { status: 400, headers: corsHeaders })
    }

    // Fetch loot table
    const { data: lootTable } = await supabase
      .from('frame_pack_loot_table')
      .select('*')
      .eq('pack_id', pack_id)

    if (!lootTable || lootTable.length === 0) {
      return new Response(JSON.stringify({ error: 'Loot table empty' }), { status: 500, headers: corsHeaders })
    }

    // Check pity counter
    let pityActivated = false
    const pityConfig = PITY_CONFIG[pack_id]
    if (pityConfig) {
      const { data: recentPacks } = await supabase
        .from('user_pack_history')
        .select('reward_type, reward_value')
        .eq('user_id', user.id)
        .eq('pack_id', pack_id)
        .order('opened_at', { ascending: false })
        .limit(pityConfig.threshold)

      if (recentPacks && recentPacks.length >= pityConfig.threshold) {
        const minTierIdx = FRAME_TIER_ORDER.indexOf(pityConfig.guaranteeMinTier)
        const hasHighTier = recentPacks.some(p => {
          if (p.reward_type !== 'frame') return false
          const idx = FRAME_TIER_ORDER.indexOf(p.reward_value)
          return idx >= minTierIdx
        })
        if (!hasHighTier) pityActivated = true
      }
    }

    // Weighted RNG roll
    let reward: { type: string; value: string; qty: number }

    if (pityActivated && pityConfig) {
      // Pity: pick from eligible frames at or above guarantee tier
      const minIdx = FRAME_TIER_ORDER.indexOf(pityConfig.guaranteeMinTier)
      const eligible = lootTable.filter(l =>
        l.reward_type === 'frame' && FRAME_TIER_ORDER.indexOf(l.reward_value) >= minIdx
      )
      if (eligible.length > 0) {
        const pick = eligible[Math.floor(Math.random() * eligible.length)]
        reward = { type: 'frame', value: pick.reward_value, qty: 1 }
      } else {
        // Fallback: just give the guaranteed tier
        reward = { type: 'frame', value: pityConfig.guaranteeMinTier, qty: 1 }
      }
    } else {
      // Normal weighted roll
      const totalWeight = lootTable.reduce((sum, l) => sum + l.weight, 0)
      let roll = Math.random() * totalWeight
      let picked = lootTable[0]
      for (const entry of lootTable) {
        roll -= entry.weight
        if (roll <= 0) { picked = entry; break }
      }

      const qty = picked.min_qty === picked.max_qty
        ? picked.min_qty
        : picked.min_qty + Math.floor(Math.random() * (picked.max_qty - picked.min_qty + 1))

      reward = { type: picked.reward_type, value: picked.reward_value, qty }
    }

    // ── Deduct pack price FIRST (atomic, prevents free items) ──────
    const { error: deductError } = await supabase.rpc('deduct_coins', {
      p_user_id: user.id,
      p_amount: pack.coin_price,
    })

    if (deductError) {
      return new Response(JSON.stringify({
        error: deductError.message?.includes('Insufficient') ? 'Not enough coins' : deductError.message,
      }), { status: 400, headers: corsHeaders })
    }

    // Handle reward (coins already deducted — safe to grant)
    let isDuplicate = false
    let coinsRefunded = 0

    if (reward.type === 'frame') {
      // Check if user already owns this frame
      const { data: existing } = await supabase
        .from('user_unlocked_items')
        .select('item_code')
        .eq('user_id', user.id)
        .eq('item_type', 'frame')
        .eq('item_code', reward.value)
        .maybeSingle()

      if (existing) {
        // Duplicate: refund 40% of pack price
        isDuplicate = true
        coinsRefunded = Math.floor(pack.coin_price * 0.4)
      } else {
        // Grant frame atomically — ON CONFLICT prevents double-grant race
        const { error: insertErr } = await supabase.from('user_unlocked_items').insert({
          user_id: user.id,
          item_type: 'frame',
          item_code: reward.value,
          unlocked_via: 'pack'
        })
        if (insertErr) {
          // PK conflict = concurrent request already granted it → treat as duplicate
          isDuplicate = true
          coinsRefunded = Math.floor(pack.coin_price * 0.4)
        }
      }
    }

    // Add back any coin reward or duplicate refund
    const coinReward = reward.type === 'coins' ? reward.qty : 0
    const totalRefund = coinsRefunded + coinReward
    if (totalRefund > 0) {
      await supabase.rpc('add_coins', { p_user_id: user.id, p_amount: totalRefund })
    }

    // Wallet ledger: pack purchase
    await supabase.from('wallet_ledger').insert({
      user_id: user.id,
      delta: -pack.coin_price,
      reason: 'pack_purchase',
      reference_id: pack_id
    })

    // Wallet ledger: coin reward or duplicate refund
    if (coinReward > 0) {
      await supabase.from('wallet_ledger').insert({
        user_id: user.id,
        delta: coinReward,
        reason: 'pack_coin_reward',
        reference_id: pack_id
      })
    }
    if (coinsRefunded > 0) {
      await supabase.from('wallet_ledger').insert({
        user_id: user.id,
        delta: coinsRefunded,
        reason: 'duplicate_refund',
        reference_id: pack_id
      })
    }

    // Log to user_pack_history
    await supabase.from('user_pack_history').insert({
      user_id: user.id,
      pack_id,
      reward_type: reward.type,
      reward_value: reward.value,
      reward_qty: reward.qty,
      is_duplicate: isDuplicate,
      coins_refunded: coinsRefunded
    })

    // Get updated balance
    const { data: updatedProfile } = await supabase
      .from('profiles').select('coins').eq('id', user.id).single()

    return new Response(JSON.stringify({
      success: true,
      reward: {
        type: reward.type,
        value: reward.value,
        qty: reward.qty,
      },
      is_duplicate: isDuplicate,
      coins_refunded: coinsRefunded,
      pity_activated: pityActivated,
      new_balance: updatedProfile?.coins ?? 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
