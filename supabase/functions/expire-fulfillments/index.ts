// Supabase Edge Function: expire-fulfillments
// Runs daily via cron — sets pending_fulfillment to 'expired' after 14 days
// Expired entries do NOT affect reliability score (neither positive nor negative)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date().toISOString()

    // Find all expired pending fulfillments
    const { data: expired, error } = await supabase
      .from('challenge_fulfillment')
      .select('id')
      .eq('status', 'pending_fulfillment')
      .lt('expires_at', now)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let count = 0
    if (expired && expired.length > 0) {
      // Update to 'expired' — this does NOT trigger recalc_reliability
      // because the trigger only fires for 'fulfilled' or 'unfulfilled'
      const { error: updateErr } = await supabase
        .from('challenge_fulfillment')
        .update({ status: 'expired' })
        .eq('status', 'pending_fulfillment')
        .lt('expires_at', now)

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      count = expired.length
    }

    return new Response(JSON.stringify({
      success: true,
      expired_count: count,
      checked_at: now,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
