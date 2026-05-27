import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering so env vars are available at runtime, not build time
export const dynamic = 'force-dynamic'
// Use Node.js runtime (not edge) for full Node.js API access
export const runtime = 'nodejs'

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe billing portal session so the user can review payment history,
 * download invoices, and update payment methods. DealBuddy currently only sells
 * one-time charges (coins, premium pass, mystery box) — no recurring subscriptions
 * exist, so §312k BGB does not apply. This endpoint is a self-service convenience
 * and works for any user who has at least one prior Stripe checkout session.
 *
 * Auth: Bearer access_token from Supabase session.
 * Returns: { url: string } portal session URL on success.
 */
export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    console.error('[billing/portal] STRIPE_SECRET_KEY is not set')
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const user = authData.user
  const email = user.email
  if (!email) {
    return NextResponse.json(
      { error: 'No email on account', code: 'NO_EMAIL' },
      { status: 400 }
    )
  }

  const stripe = new Stripe(stripeKey, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 1,
  })

  try {
    // Look up the most recent Stripe checkout session for this user to find the
    // associated customer id. We persist session_id but not customer_id, so this
    // is the cheapest reliable lookup path.
    const { data: lastTx } = await supabase
      .from('stripe_transactions')
      .select('session_id')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let customerId: string | null = null

    if (lastTx?.session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(lastTx.session_id)
        if (session.customer) {
          customerId = typeof session.customer === 'string' ? session.customer : session.customer.id
        }
      } catch (err) {
        console.warn('[billing/portal] could not retrieve checkout session:', err)
      }
    }

    // Fallback: try to find a Stripe customer by email
    if (!customerId) {
      const customers = await stripe.customers.list({ email, limit: 1 })
      if (customers.data.length > 0) {
        customerId = customers.data[0].id
      }
    }

    if (!customerId) {
      return NextResponse.json(
        {
          error: 'No purchase history found for this account.',
          code: 'NO_PURCHASES',
        },
        { status: 404 }
      )
    }

    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://app.deal-buddy.app'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app/settings`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    const e = err as { type?: string; code?: string; message?: string }
    console.error('[billing/portal] error:', {
      type: e?.type,
      code: e?.code,
      message: e?.message,
    })
    return NextResponse.json(
      { error: e?.message || 'Portal session failed', type: e?.type || 'unknown' },
      { status: 500 }
    )
  }
}
