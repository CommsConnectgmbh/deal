import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering so env vars are available at runtime, not build time
export const dynamic = 'force-dynamic'
// Use Node.js runtime (not edge) for full Node.js API access
export const runtime = 'nodejs'

const PRODUCTS: Record<string, { name: string; amount: number; coins?: number; description: string }> = {
  // V11 coin packs (updated tiers)
  coin_pack_xs: {
    name: 'DealBuddy – 500 Buddy Coins',
    amount: 299,
    coins: 500,
    description: '500 Buddy Coins für die DealBuddy App'
  },
  coin_pack_sm: {
    name: 'DealBuddy – 1.200 Buddy Coins',
    amount: 599,
    coins: 1200,
    description: '1.200 Buddy Coins für die DealBuddy App'
  },
  coin_pack_md: {
    name: 'DealBuddy – 2.500 Buddy Coins',
    amount: 999,
    coins: 2500,
    description: '2.500 Buddy Coins für die DealBuddy App'
  },
  coin_pack_lg: {
    name: 'DealBuddy – 6.000 Buddy Coins',
    amount: 1999,
    coins: 6000,
    description: '6.000 Buddy Coins für die DealBuddy App'
  },
  coin_pack_xl: {
    name: 'DealBuddy – 15.000 Buddy Coins',
    amount: 3999,
    coins: 15000,
    description: '15.000 Buddy Coins für die DealBuddy App'
  },
  premium_pass: {
    name: 'DealBuddy – Premium Battle Pass Season 1',
    amount: 999,
    description: 'Premium Battle Pass für Season 1 – The Founders Era'
  },
  legendary_box: {
    name: 'DealBuddy – Legendary Mystery Box',
    amount: 499,
    description: 'Legendary Mystery Box – garantierter epischer oder legendärer Reward'
  }
}

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set')
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  // Auth: verify user from JWT
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const token = authHeader.replace('Bearer ', '')
  const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !authUser) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Use fetch-based HTTP client – works reliably in Vercel serverless
  const stripe = new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 1,
  })

  try {
    const { product_type } = await req.json()
    const user_id = authUser.id // Always use authenticated user's ID

    if (!product_type) {
      return NextResponse.json({ error: 'Missing product_type' }, { status: 400 })
    }

    const product = PRODUCTS[product_type]
    if (!product) {
      return NextResponse.json({ error: 'Invalid product_type' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://app.deal-buddy.app'

    const session = await stripe.checkout.sessions.create({
      // card = includes Apple Pay + Google Pay on compatible devices
      payment_method_types: ['card', 'paypal', 'link', 'amazon_pay'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: product.name,
            description: product.description
          },
          unit_amount: product.amount
        },
        quantity: 1
      }],
      metadata: {
        user_id,
        product_type,
        coins: product.coins ? String(product.coins) : '0'
      },
      success_url: `${origin}/app/shop?success=1&product=${product_type}`,
      cancel_url: `${origin}/app/shop?cancelled=1`
    })

    // Store pending transaction in Supabase (using service role)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await supabase.from('stripe_transactions').insert({
      user_id,
      session_id: session.id,
      status: 'pending',
      product_type,
      amount_cents: product.amount,
      coins_awarded: product.coins || 0
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Stripe session error:', {
      type: error?.type,
      code: error?.code,
      message: error?.message,
      statusCode: error?.statusCode,
    })
    return NextResponse.json({
      error: error?.message || 'Unknown Stripe error',
      type: error?.type || 'unknown'
    }, { status: 500 })
  }
}
