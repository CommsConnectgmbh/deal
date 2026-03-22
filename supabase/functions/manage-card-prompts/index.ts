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

    const url = new URL(req.url)

    // ── GET: Load all prompts ──
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('card_prompts')
        .select('*')
        .order('prompt_type')
        .order('prompt_key')

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Reshape into structured format
      const result: any = {
        master: '',
        base_prompt: '',
        archetype_blocks: {} as Record<string, string>,
        custom: [] as Array<{ key: string; content: string }>,
        raw: data,
      }

      for (const row of data || []) {
        if (row.prompt_key === 'master') {
          result.master = row.content
        } else if (row.prompt_key === 'base_prompt') {
          result.base_prompt = row.content
        } else if (row.prompt_type === 'archetype_block') {
          // block_founder → founder
          const name = row.prompt_key.replace('block_', '')
          result.archetype_blocks[name] = row.content
        } else if (row.prompt_type === 'custom') {
          result.custom.push({ key: row.prompt_key, content: row.content })
        }
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── POST: Upsert a prompt ──
    if (req.method === 'POST') {
      const { key, type, content } = await req.json()

      if (!key || !type || !content) {
        return new Response(JSON.stringify({ error: 'Missing key, type, or content' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Validate type
      const validTypes = ['master', 'base', 'archetype_block', 'custom']
      if (!validTypes.includes(type)) {
        return new Response(JSON.stringify({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data, error } = await supabase
        .from('card_prompts')
        .upsert({
          prompt_key: key,
          prompt_type: type,
          content,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'prompt_key' })
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

    // ── DELETE: Remove a prompt by key ──
    if (req.method === 'DELETE') {
      const { key } = await req.json()

      if (!key) {
        return new Response(JSON.stringify({ error: 'Missing key' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Prevent deleting master or base_prompt
      if (key === 'master' || key === 'base_prompt') {
        return new Response(JSON.stringify({ error: 'Cannot delete master or base_prompt' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { error } = await supabase
        .from('card_prompts')
        .delete()
        .eq('prompt_key', key)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, deleted: key }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[manage-card-prompts] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: corsHeaders
    })
  }
})
