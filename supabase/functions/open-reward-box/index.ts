// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), { status: 401, headers: corsHeaders })
    }

    // Rate limit: 20 opens per hour
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id, p_action: 'open_reward_box', p_max_count: 20, p_window_minutes: 60
    })
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: corsHeaders })
    }

    const { box_id } = await req.json()
    if (!box_id || !UUID_RE.test(box_id)) {
      return new Response(JSON.stringify({ error: 'Invalid box_id' }), { status: 400, headers: corsHeaders })
    }

    // Get box info
    const { data: box } = await supabase.from('reward_boxes').select('*').eq('id', box_id).single()
    if (!box) {
      return new Response(JSON.stringify({ error: 'Box not found' }), { status: 404, headers: corsHeaders })
    }

    // Atomic coin deduction (prevents race conditions)
    const { data: deducted } = await supabase.rpc('deduct_coins', {
      p_user_id: user.id, p_amount: box.price_coins
    })
    if (!deducted) {
      return new Response(JSON.stringify({ error: 'Not enough coins' }), { status: 400, headers: corsHeaders })
    }

    // Log wallet ledger
    await supabase.from('wallet_ledger').insert({
      user_id: user.id,
      delta: -box.price_coins,
      reason: 'reward_box_open',
      reference_id: box_id
    })

    // Get loot table
    const { data: lootTable } = await supabase
      .from('reward_box_loot_table')
      .select('*')
      .eq('box_id', box_id)

    if (!lootTable || lootTable.length === 0) {
      return new Response(JSON.stringify({ error: 'No loot table for this box' }), { status: 500, headers: corsHeaders })
    }

    // Weighted random selection
    const totalWeight = lootTable.reduce((sum: number, r: any) => sum + r.weight, 0)
    let roll = Math.random() * totalWeight
    let winner = lootTable[lootTable.length - 1]
    for (const entry of lootTable) {
      roll -= entry.weight
      if (roll <= 0) {
        winner = entry
        break
      }
    }

    // Calculate quantity (random between min and max)
    const qty = winner.min_qty === winner.max_qty
      ? winner.min_qty
      : Math.floor(Math.random() * (winner.max_qty - winner.min_qty + 1)) + winner.min_qty

    // Award reward
    let itemName = winner.reward_value
    let itemEmoji = '🎁'

    if (winner.reward_type === 'coins') {
      await supabase.rpc('add_coins', { p_user_id: user.id, p_amount: qty })
      await supabase.from('wallet_ledger').insert({
        user_id: user.id,
        delta: qty,
        reason: 'reward_box_win_coins',
        reference_id: box_id
      })
      itemName = `${qty} Coins`
      itemEmoji = '🪙'
    } else if (winner.reward_type === 'cosmetic') {
      await supabase.from('user_inventory').upsert({
        user_id: user.id,
        cosmetic_id: winner.reward_value,
        source: 'reward_box'
      }, { onConflict: 'user_id,cosmetic_id' })
      itemEmoji = '✨'
    } else if (winner.reward_type === 'avatar_item') {
      const { data: avatarItem } = await supabase
        .from('avatar_items')
        .select('name, icon_emoji')
        .eq('id', winner.reward_value)
        .single()
      await supabase.from('user_avatar_inventory').upsert({
        user_id: user.id,
        item_id: winner.reward_value
      }, { onConflict: 'user_id,item_id' })
      if (avatarItem) {
        itemName = avatarItem.name
        itemEmoji = avatarItem.icon_emoji
      }
    } else if (winner.reward_type === 'battle_pass_xp') {
      await supabase.from('user_battlepass')
        .upsert({
          user_id: user.id,
          season_xp: qty
        }, { onConflict: 'user_id' })
      // Actually increment properly
      await supabase.rpc('increment_bp_xp', { uid: user.id, xp_amount: qty }).catch(() => {
        // Fallback: just add manually
        supabase.from('user_battlepass').select('season_xp').eq('user_id', user.id).single().then(({ data }) => {
          if (data) {
            supabase.from('user_battlepass').update({ season_xp: (data.season_xp || 0) + qty }).eq('user_id', user.id)
          }
        })
      })
      itemName = `${qty} Battle Pass XP`
      itemEmoji = '⚡'
    }

    // Log history
    await supabase.from('reward_box_history').insert({
      user_id: user.id,
      box_id,
      reward_type: winner.reward_type,
      reward_value: winner.reward_value,
      qty
    })

    return new Response(JSON.stringify({
      success: true,
      reward_type: winner.reward_type,
      reward_value: winner.reward_value,
      qty,
      item_name: itemName,
      item_emoji: itemEmoji
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('open-reward-box error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders
    })
  }
})
