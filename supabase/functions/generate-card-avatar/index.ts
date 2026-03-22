// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const {
      mode = 'base',       // 'base' | 'archetype'
      gender = 'male',
      age = 'young',
      origin = 'european',
      hair = 'short hair',
      archetype,            // e.g. 'founder' (required for archetype mode)
      customPrompt,         // optional override prompt
    } = body

    // ── Load prompts from DB ──
    const { data: prompts, error: promptErr } = await supabase
      .from('card_prompts')
      .select('prompt_key, prompt_type, content')

    if (promptErr || !prompts) {
      return new Response(JSON.stringify({ error: 'Failed to load prompts', details: promptErr?.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const promptMap: Record<string, string> = {}
    for (const p of prompts) {
      promptMap[p.prompt_key] = p.content
    }

    // ── Build prompt ──
    let finalPrompt = ''
    const dnaLine = `Character DNA: ${gender}, ${age}, ${origin}, ${hair}.`

    if (customPrompt) {
      // Custom prompt override — just use it directly
      finalPrompt = customPrompt
    } else if (mode === 'base') {
      // Base avatar: base_prompt + DNA
      const basePrompt = promptMap['base_prompt'] || 'Create a detailed avatar portrait.'
      finalPrompt = `${basePrompt}\n\n${dnaLine}`
    } else if (mode === 'archetype') {
      // Archetype: master + base_prompt + DNA + archetype block
      const master = promptMap['master'] || ''
      const basePrompt = promptMap['base_prompt'] || ''
      const blockKey = `block_${archetype}`
      const archetypeBlock = promptMap[blockKey] || ''

      if (!archetypeBlock) {
        return new Response(JSON.stringify({ error: `Unknown archetype: ${archetype}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      finalPrompt = `${master}\n\n${basePrompt}\n\n${dnaLine}\n\n${archetypeBlock}`
    } else {
      return new Response(JSON.stringify({ error: `Invalid mode: ${mode}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[generate-card-avatar] mode=${mode}, archetype=${archetype || 'none'}, prompt length=${finalPrompt.length}`)

    // ── Call OpenAI GPT-Image-1 ──
    const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: finalPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'high',
        output_format: 'webp',
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error('[generate-card-avatar] OpenAI error:', errText)
      return new Response(JSON.stringify({ error: 'OpenAI API error', details: errText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const openaiData = await openaiRes.json()
    const b64Image = openaiData.data?.[0]?.b64_json

    if (!b64Image) {
      return new Response(JSON.stringify({ error: 'No image data from OpenAI' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Decode base64 → Uint8Array ──
    const binaryStr = atob(b64Image)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    // ── Build filename ──
    const g = gender === 'male' ? 'M' : 'F'
    const a = age.charAt(0).toUpperCase()
    const o = origin.substring(0, 2).toUpperCase()
    const h = hair.replace(/\s+/g, '').substring(0, 3).toUpperCase()
    const ts = Date.now()
    const prefix = mode === 'archetype' ? (archetype || 'custom').toUpperCase() : 'BASE'
    const fileName = `avatars/${prefix}_${g}_${a}_${o}_${h}_${ts}.webp`

    // ── Upload to Supabase Storage ──
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('card-images')
      .upload(fileName, bytes, {
        contentType: 'image/webp',
        upsert: false,
      })

    if (uploadErr) {
      console.error('[generate-card-avatar] Storage upload error:', uploadErr)
      return new Response(JSON.stringify({ error: 'Storage upload failed', details: uploadErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Get public URL ──
    const { data: urlData } = supabase.storage
      .from('card-images')
      .getPublicUrl(fileName)

    const publicUrl = urlData?.publicUrl || ''

    // ── Build code ──
    const code = `${prefix}_${g}_${a}_${o}_${h}`

    console.log(`[generate-card-avatar] Success: ${code} → ${publicUrl}`)

    return new Response(JSON.stringify({
      success: true,
      code,
      imageUrl: publicUrl,
      prompt: finalPrompt,
      fileName,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[generate-card-avatar] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: corsHeaders
    })
  }
})
