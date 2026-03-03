// Supabase Edge Function: stripe-webhook
// Handles Stripe webhook events – never trust client

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Webhook Error', { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { user_id, product_type, coins } = session.metadata || {}

    if (!user_id || !product_type) {
      console.error('Missing metadata in session', session.id)
      return new Response('Missing metadata', { status: 400 })
    }

    // Update transaction status
    await supabase.from('stripe_transactions').update({
      status: 'completed',
      completed_at: new Date().toISOString()
    }).eq('session_id', session.id)

    if (product_type === 'premium_pass') {
      // Unlock premium battle pass
      await supabase.from('user_battlepass')
        .upsert({
          user_id,
          season_id: 1,
          premium_unlocked: true
        }, { onConflict: 'user_id,season_id' })

      // Also update profiles.battle_pass_premium for quick access
      await supabase.from('profiles')
        .update({ battle_pass_premium: true })
        .eq('id', user_id)

      // Notify user
      await supabase.from('notifications').insert({
        user_id,
        type: 'premium_unlocked',
        title: '🔥 Premium Pass aktiviert!',
        body: 'Dein Premium Battle Pass für Season 1 ist jetzt aktiv.',
        data: { product_type }
      })
    } else if (product_type.startsWith('coin_pack')) {
      const coinsAmount = parseInt(coins || '0', 10)
      if (coinsAmount > 0) {
        // Credit coins
        await supabase.from('wallet_ledger').insert({
          user_id,
          delta: coinsAmount,
          reason: 'purchase_stripe',
          reference_id: session.id
        })

        await supabase.from('profiles')
          .update({ coins: supabase.rpc('add_coins', { p_user_id: user_id, p_amount: coinsAmount }) })
          .eq('id', user_id)

        // Fallback: direct increment via RPC or update
        const { data: p } = await supabase.from('profiles').select('coins').eq('id', user_id).single()
        await supabase.from('profiles').update({ coins: (p?.coins || 0) + coinsAmount }).eq('id', user_id)

        // Notify user
        await supabase.from('notifications').insert({
          user_id,
          type: 'coins_purchased',
          title: `💰 ${coinsAmount} Buddy Coins erhalten!`,
          body: 'Deine Coins wurden deinem Konto gutgeschrieben.',
          data: { coins: coinsAmount, product_type }
        })
      }
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session
    await supabase.from('stripe_transactions').update({ status: 'failed' }).eq('session_id', session.id)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
