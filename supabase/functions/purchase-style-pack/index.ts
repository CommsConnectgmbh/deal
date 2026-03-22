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

    // Rate limit: 10 purchases per hour
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id, p_action: 'purchase_style_pack', p_max_count: 10, p_window_minutes: 60
    })
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: corsHeaders })
    }

    const { pack_id } = await req.json()
    if (!pack_id || !UUID_RE.test(pack_id)) {
      return new Response(JSON.stringify({ error: 'Invalid pack_id' }), { status: 400, headers: corsHeaders })
    }

    // Get pack info
    const { data: pack } = await supabase.from('style_packs').select('*').eq('id', pack_id).eq('active', true).single()
    if (!pack) {
      return new Response(JSON.stringify({ error: 'Pack not found' }), { status: 404, headers: corsHeaders })
    }

    // Get pack items
    const { data: packItems } = await supabase
      .from('style_pack_items')
      .select('*')
      .eq('pack_id', pack_id)

    if (!packItems || packItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Pack has no items' }), { status: 500, headers: corsHeaders })
    }

    // Check if user already owns ALL items in this pack (prevent accidental re-purchase)
    const cosmeticIds = packItems.filter(pi => pi.item_type === 'cosmetic').map(pi => pi.item_id)
    const avatarIds = packItems.filter(pi => pi.item_type === 'avatar_item').map(pi => pi.item_id)

    let ownedCount = 0
    if (cosmeticIds.length > 0) {
      const { count } = await supabase
        .from('user_inventory')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('cosmetic_id', cosmeticIds)
      ownedCount += count || 0
    }
    if (avatarIds.length > 0) {
      const { count } = await supabase
        .from('user_avatar_inventory')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('item_id', avatarIds)
      ownedCount += count || 0
    }

    if (ownedCount >= packItems.length) {
      return new Response(JSON.stringify({ error: 'Pack already owned' }), { status: 400, headers: corsHeaders })
    }

    // Atomic coin deduction
    const { data: deducted } = await supabase.rpc('deduct_coins', {
      p_user_id: user.id, p_amount: pack.price_coins
    })
    if (!deducted) {
      return new Response(JSON.stringify({ error: 'Not enough coins' }), { status: 400, headers: corsHeaders })
    }
    await supabase.from('wallet_ledger').insert({
      user_id: user.id,
      delta: -pack.price_coins,
      reason: 'style_pack_purchase',
      reference_id: pack_id
    })

    // Grant all items
    const grantedItems = []
    for (const pi of packItems) {
      if (pi.item_type === 'cosmetic') {
        await supabase.from('user_inventory').upsert({
          user_id: user.id,
          cosmetic_id: pi.item_id,
          source: 'style_pack'
        }, { onConflict: 'user_id,cosmetic_id' })
      } else if (pi.item_type === 'avatar_item') {
        await supabase.from('user_avatar_inventory').upsert({
          user_id: user.id,
          item_id: pi.item_id
        }, { onConflict: 'user_id,item_id' })
      }
      grantedItems.push(pi.item_id)
    }

    return new Response(JSON.stringify({
      success: true,
      pack_id,
      items_granted: grantedItems
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('purchase-style-pack error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders
    })
  }
})
