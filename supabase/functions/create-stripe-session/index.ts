// Supabase Edge Function: create-stripe-session
// Creates a Stripe Checkout session for coin packs or premium pass

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PRODUCTS = {
  coin_pack_small: {
    name: '500 Buddy Coins',
    description: '500 Buddy Coins für den Shop',
    amount_cents: 499,
    coins: 500,
    currency: 'eur'
  },
  coin_pack_large: {
    name: '1500 Buddy Coins',
    description: '1500 Buddy Coins – Bestes Angebot',
    amount_cents: 999,
    coins: 1500,
    currency: 'eur'
  },
  premium_pass: {
    name: 'Premium Battle Pass – Season 1',
    description: 'Schalte exklusive Cosmetics und Premium-Rewards frei',
    amount_cents: 999,
    coins: 0,
    currency: 'eur'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), { status: 401, headers: corsHeaders })
    }

    // Rate limit: 5 checkout sessions per hour
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id, p_action: 'stripe_checkout', p_max_count: 5, p_window_minutes: 60
    })
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: corsHeaders })
    }

    const { product_type, success_url, cancel_url } = await req.json()

    const product = PRODUCTS[product_type as keyof typeof PRODUCTS]
    if (!product) return new Response(JSON.stringify({ error: 'Invalid product' }), { status: 400, headers: corsHeaders })

    // Check if premium pass already owned
    if (product_type === 'premium_pass') {
      const { data: bp } = await supabase
        .from('user_battlepass')
        .select('premium_unlocked')
        .eq('user_id', user.id)
        .eq('season_id', 1)
        .single()

      if (bp?.premium_unlocked) {
        return new Response(JSON.stringify({ error: 'Premium already unlocked' }), { status: 400, headers: corsHeaders })
      }
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://app.deal-buddy.app'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: product.currency,
          product_data: { name: product.name, description: product.description },
          unit_amount: product.amount_cents
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: success_url || `${appUrl}/app/shop?payment=success`,
      cancel_url: cancel_url || `${appUrl}/app/shop?payment=cancelled`,
      metadata: {
        user_id: user.id,
        product_type,
        coins: String(product.coins)
      }
    })

    // Store pending transaction
    await supabase.from('stripe_transactions').insert({
      user_id: user.id,
      session_id: session.id,
      status: 'pending',
      product_type,
      amount_cents: product.amount_cents,
      coins_awarded: product.coins
    })

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
