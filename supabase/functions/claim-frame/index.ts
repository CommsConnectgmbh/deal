// Supabase Edge Function: claim-frame
// Handles frame claiming for all 3 categories:
//   - Shop: deducts coins, grants frame
//   - Prestige: validates progress, grants frame
//   - Event: validates event active + progress, grants frame
// V11 Store Redesign

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

    const { frame_id, action } = await req.json()
    if (!frame_id) {
      return new Response(JSON.stringify({ error: 'Missing frame_id' }), { status: 400, headers: corsHeaders })
    }

    // Fetch frame definition
    const { data: frame, error: frameError } = await supabase
      .from('frame_definitions')
      .select('*')
      .eq('id', frame_id)
      .eq('is_active', true)
      .single()

    if (frameError || !frame) {
      return new Response(JSON.stringify({ error: 'Frame not found' }), { status: 404, headers: corsHeaders })
    }

    // Check if already owned
    const { data: existing } = await supabase
      .from('user_unlocked_items')
      .select('item_code')
      .eq('user_id', user.id)
      .eq('item_type', 'frame')
      .eq('item_code', frame_id)
      .maybeSingle()

    // If action is 'equip', just equip the frame
    if (action === 'equip') {
      // Bronze is the free starter frame — always available even without user_unlocked_items entry
      if (!existing && frame_id !== 'bronze') {
        return new Response(JSON.stringify({ error: 'Frame not owned' }), { status: 400, headers: corsHeaders })
      }
      await supabase.from('profiles').update({ active_frame: frame_id }).eq('id', user.id)

      // Sync user_cards.is_equipped — find a card the user owns matching this frame
      const { data: matchingCards } = await supabase
        .from('user_cards')
        .select('id, card_catalog!inner(frame)')
        .eq('user_id', user.id)
        .eq('card_catalog.frame', frame_id)
        .order('obtained_at', { ascending: false })
        .limit(1)

      let matching_card_id = matchingCards?.[0]?.id as string | undefined

      // No matching card yet — provision one (happens for bronze starter, or legacy users)
      if (!matching_card_id) {
        try {
          const { data: newCardId } = await supabase.rpc('assign_card_for_frame', {
            p_user_id: user.id,
            p_frame: frame_id,
            p_obtained_from: 'equip'
          })
          if (newCardId) {
            const { data: newUserCard } = await supabase
              .from('user_cards')
              .select('id')
              .eq('user_id', user.id)
              .eq('card_id', newCardId)
              .maybeSingle()
            matching_card_id = newUserCard?.id
          }
        } catch (e) {
          console.error('Card assignment during equip failed:', e)
        }
      }

      if (matching_card_id) {
        // Unequip all other cards, equip the matching one
        await supabase.from('user_cards')
          .update({ is_equipped: false })
          .eq('user_id', user.id)
          .neq('id', matching_card_id)
        await supabase.from('user_cards')
          .update({ is_equipped: true })
          .eq('id', matching_card_id)
      }

      return new Response(JSON.stringify({ success: true, action: 'equipped', frame_id, card_id: matching_card_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (existing) {
      return new Response(JSON.stringify({ error: 'Frame already owned' }), { status: 400, headers: corsHeaders })
    }

    // Route by category
    if (frame.category === 'shop') {
      // ─── SHOP FRAME: deduct coins atomically ───
      const { error: deductError } = await supabase.rpc('deduct_coins', {
        p_user_id: user.id,
        p_amount: frame.coin_price,
      })

      if (deductError) {
        // deduct_coins raises 'Insufficient coins' if balance too low
        return new Response(JSON.stringify({
          error: deductError.message?.includes('Insufficient') ? 'Not enough coins' : deductError.message,
          required: frame.coin_price,
        }), { status: 400, headers: corsHeaders })
      }

      // Wallet ledger
      await supabase.from('wallet_ledger').insert({
        user_id: user.id,
        delta: -frame.coin_price,
        reason: 'frame_purchase',
        reference_id: frame_id
      })

      // Grant frame — handle PK conflict (race: another request already granted it)
      const { error: insertErr } = await supabase.from('user_unlocked_items').insert({
        user_id: user.id,
        item_type: 'frame',
        item_code: frame_id,
        unlocked_via: 'coins'
      })

      if (insertErr) {
        // PK conflict = frame already granted by concurrent request → refund coins
        await supabase.rpc('add_coins', { p_user_id: user.id, p_amount: frame.coin_price })
        await supabase.from('wallet_ledger').insert({
          user_id: user.id,
          delta: frame.coin_price,
          reason: 'duplicate_refund',
          reference_id: frame_id
        })
        return new Response(JSON.stringify({ error: 'Frame already owned' }), { status: 400, headers: corsHeaders })
      }

      // Auto-assign a card for this frame
      let card_id = null
      try {
        const { data: cardResult } = await supabase.rpc('assign_card_for_frame', {
          p_user_id: user.id,
          p_frame: frame_id,
          p_obtained_from: 'shop'
        })
        card_id = cardResult
      } catch (e) {
        console.error('Card assignment failed (non-blocking):', e)
      }

      // Auto-equip the new frame
      await supabase.from('profiles').update({ active_frame: frame_id }).eq('id', user.id)

      // Get new balance for response
      const { data: updatedProfile } = await supabase
        .from('profiles').select('coins').eq('id', user.id).single()

      return new Response(JSON.stringify({
        success: true,
        action: 'purchased',
        frame_id,
        coins_spent: frame.coin_price,
        new_balance: updatedProfile?.coins ?? 0,
        card_id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } else if (frame.category === 'prestige') {
      // ─── PRESTIGE FRAME: validate progress ───

      // Recompute progress first
      await supabase.rpc('compute_frame_progress', { p_user_id: user.id })

      // Check if claimable
      const { data: progress } = await supabase
        .from('user_frame_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('frame_id', frame_id)
        .single()

      if (!progress || !progress.is_claimable) {
        return new Response(JSON.stringify({
          error: 'Frame not yet earned',
          current: progress?.current_value || 0,
          target: progress?.target_value || 0,
          progress_pct: progress?.progress_pct || 0
        }), { status: 400, headers: corsHeaders })
      }

      // Grant frame
      await supabase.from('user_unlocked_items').insert({
        user_id: user.id,
        item_type: 'frame',
        item_code: frame_id,
        unlocked_via: 'prestige'
      })

      // Auto-assign card
      let card_id = null
      try {
        const { data: cardResult } = await supabase.rpc('assign_card_for_frame', {
          p_user_id: user.id, p_frame: frame_id, p_obtained_from: 'achievement'
        })
        card_id = cardResult
      } catch (e) { console.error('Card assignment failed:', e) }

      // Auto-equip
      await supabase.from('profiles').update({ active_frame: frame_id }).eq('id', user.id)

      // Notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'frame_unlocked',
        title: `🎖️ ${frame.name_de} freigeschaltet!`,
        body: `Du hast den ${frame.name_de}-Rahmen durch deine Leistungen verdient!`,
        data: { frame_id, category: 'prestige' }
      })

      return new Response(JSON.stringify({
        success: true,
        action: 'claimed_prestige',
        frame_id,
        frame_name: frame.name_de,
        card_id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } else if (frame.category === 'event') {
      // ─── EVENT FRAME: validate event active + progress ───

      // Check event is active
      if (frame.event_id) {
        const { data: event } = await supabase
          .from('events')
          .select('*')
          .eq('id', frame.event_id)
          .eq('is_active', true)
          .single()

        if (!event) {
          return new Response(JSON.stringify({ error: 'Event not active' }), { status: 400, headers: corsHeaders })
        }

        const now = new Date()
        if (now < new Date(event.starts_at) || now > new Date(event.ends_at)) {
          return new Response(JSON.stringify({ error: 'Event has ended' }), { status: 400, headers: corsHeaders })
        }
      }

      // Recompute and check progress
      await supabase.rpc('compute_frame_progress', { p_user_id: user.id })

      const { data: progress } = await supabase
        .from('user_frame_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('frame_id', frame_id)
        .single()

      if (!progress || !progress.is_claimable) {
        return new Response(JSON.stringify({
          error: 'Event frame not yet earned',
          current: progress?.current_value || 0,
          target: progress?.target_value || 0,
          progress_pct: progress?.progress_pct || 0
        }), { status: 400, headers: corsHeaders })
      }

      // Grant frame
      await supabase.from('user_unlocked_items').insert({
        user_id: user.id,
        item_type: 'frame',
        item_code: frame_id,
        unlocked_via: 'event'
      })

      // Mark event progress as claimed
      if (frame.event_id) {
        await supabase.from('user_event_progress').update({
          claimed: true
        }).eq('user_id', user.id).eq('event_id', frame.event_id)
      }

      // Auto-assign card
      let card_id_event = null
      try {
        const { data: cardResult } = await supabase.rpc('assign_card_for_frame', {
          p_user_id: user.id, p_frame: frame_id, p_obtained_from: 'event'
        })
        card_id_event = cardResult
      } catch (e) { console.error('Card assignment failed:', e) }

      // Auto-equip
      await supabase.from('profiles').update({ active_frame: frame_id }).eq('id', user.id)

      // Notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'frame_unlocked',
        title: `🎉 ${frame.name_de} freigeschaltet!`,
        body: `Du hast den Event-Rahmen ${frame.name_de} verdient!`,
        data: { frame_id, category: 'event' }
      })

      return new Response(JSON.stringify({
        success: true,
        action: 'claimed_event',
        frame_id,
        frame_name: frame.name_de,
        card_id: card_id_event,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown frame category' }), { status: 400, headers: corsHeaders })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
