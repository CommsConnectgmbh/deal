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

    const { body, hair, outfit, accessory } = await req.json()

    // Validate ownership of non-default items
    const itemsToCheck = [body, hair, outfit, accessory].filter(Boolean)
    const defaultItems = ['body_default', 'hair_default', 'outfit_default', 'acc_none']
    const nonDefaultItems = itemsToCheck.filter(id => !defaultItems.includes(id))

    if (nonDefaultItems.length > 0) {
      const { data: ownedItems } = await supabase
        .from('user_avatar_inventory')
        .select('item_id')
        .eq('user_id', user.id)
        .in('item_id', nonDefaultItems)

      const ownedIds = (ownedItems || []).map((r: any) => r.item_id)
      const notOwned = nonDefaultItems.filter(id => !ownedIds.includes(id))
      if (notOwned.length > 0) {
        return new Response(JSON.stringify({ error: 'Items not owned', not_owned: notOwned }), {
          status: 403,
          headers: corsHeaders
        })
      }
    }

    // Upsert avatar_config
    const config: Record<string, string> = { user_id: user.id, updated_at: new Date().toISOString() }
    if (body) config.body = body
    if (hair) config.hair = hair
    if (outfit) config.outfit = outfit
    if (accessory) config.accessory = accessory

    await supabase.from('avatar_config').upsert(config, { onConflict: 'user_id' })

    return new Response(JSON.stringify({ success: true, config }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('update-avatar error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders
    })
  }
})
