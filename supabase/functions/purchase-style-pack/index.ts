// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user }, error: authError } = await createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { pack_id } = await req.json()
    if (!pack_id) {
      return new Response(JSON.stringify({ error: 'Missing pack_id' }), { status: 400, headers: corsHeaders })
    }

    // Get pack info
    const { data: pack } = await supabase.from('style_packs').select('*').eq('id', pack_id).eq('active', true).single()
    if (!pack) {
      return new Response(JSON.stringify({ error: 'Pack not found' }), { status: 404, headers: corsHeaders })
    }

    // Get user profile (coins)
    const { data: profile } = await supabase.from('profiles').select('coins').eq('id', user.id).single()
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404, headers: corsHeaders })
    }

    if (profile.coins < pack.price_coins) {
      return new Response(JSON.stringify({ error: 'Not enough coins' }), { status: 400, headers: corsHeaders })
    }

    // Get pack items
    const { data: packItems } = await supabase
      .from('style_pack_items')
      .select('*')
      .eq('pack_id', pack_id)

    if (!packItems || packItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Pack has no items' }), { status: 500, headers: corsHeaders })
    }

    // Deduct coins
    await supabase.from('profiles').update({ coins: profile.coins - pack.price_coins }).eq('id', user.id)
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
