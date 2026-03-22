// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── GET: Load all DNA options ──
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('card_dna_options')
        .select('*')
        .order('field')
        .order('sort_order')

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Group by field
      const grouped: Record<string, Array<{ value: string; label: string; sort_order: number }>> = {}
      for (const row of data || []) {
        if (!grouped[row.field]) grouped[row.field] = []
        grouped[row.field].push({
          value: row.value,
          label: row.label,
          sort_order: row.sort_order,
        })
      }

      return new Response(JSON.stringify({ options: grouped, raw: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── POST: Add or update a DNA option ──
    if (req.method === 'POST') {
      const { field, value, label, sort_order } = await req.json()

      if (!field || !value || !label) {
        return new Response(JSON.stringify({ error: 'Missing field, value, or label' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const validFields = ['gender', 'age', 'origin', 'hair']
      if (!validFields.includes(field)) {
        return new Response(JSON.stringify({ error: `Invalid field. Must be one of: ${validFields.join(', ')}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data, error } = await supabase
        .from('card_dna_options')
        .upsert({
          field,
          value,
          label,
          sort_order: sort_order || 99,
        }, { onConflict: 'field,value' })
        .select()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── DELETE: Remove a DNA option ──
    if (req.method === 'DELETE') {
      const { field, value } = await req.json()

      if (!field || !value) {
        return new Response(JSON.stringify({ error: 'Missing field or value' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { error } = await supabase
        .from('card_dna_options')
        .delete()
        .eq('field', field)
        .eq('value', value)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, deleted: { field, value } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[manage-card-dna] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: corsHeaders
    })
  }
})
