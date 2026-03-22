// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const VALID_SLOTS = ['frame', 'badge', 'title', 'card', 'victory_animation']
const SLOT_TO_FIELD: Record<string, string> = {
  frame: 'active_frame',
  badge: 'active_badge',
  title: 'active_title',
  card: 'active_card',
  victory_animation: 'active_victory_animation',
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

    // Rate limit: 30 equips per hour
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id, p_action: 'equip_cosmetic', p_max_count: 30, p_window_minutes: 60
    })
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: corsHeaders })
    }

    const { slot, item_id } = await req.json()
    if (!slot || !item_id || typeof slot !== 'string' || typeof item_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing slot or item_id' }), { status: 400, headers: corsHeaders })
    }

    if (item_id.length > 100) {
      return new Response(JSON.stringify({ error: 'Invalid item_id' }), { status: 400, headers: corsHeaders })
    }

    if (!VALID_SLOTS.includes(slot)) {
      return new Response(JSON.stringify({ error: 'Invalid slot' }), { status: 400, headers: corsHeaders })
    }

    // Verify ownership (check user_inventory)
    const { data: invEntry } = await supabase
      .from('user_inventory')
      .select('cosmetic_id')
      .eq('user_id', user.id)
      .eq('cosmetic_id', item_id)
      .single()

    if (!invEntry) {
      // Check if it's a founder item (auto-granted to founders)
      const { data: profile } = await supabase.from('profiles').select('is_founder').eq('id', user.id).single()
      const founderItems = ['founder_carbon', 'season1_founder']
      if (!profile?.is_founder || !founderItems.includes(item_id)) {
        return new Response(JSON.stringify({ error: 'Item not owned' }), { status: 403, headers: corsHeaders })
      }
    }

    // Update profile
    const field = SLOT_TO_FIELD[slot]
    await supabase.from('profiles').update({ [field]: item_id }).eq('id', user.id)

    return new Response(JSON.stringify({
      success: true,
      slot,
      item_id,
      field_updated: field
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('equip-cosmetic error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders
    })
  }
})
