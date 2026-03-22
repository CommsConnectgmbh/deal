import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  // Auth
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  try {
    const { session_id } = await req.json()
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    // Finde die pending Transaction
    const { data: tx } = await supabase
      .from('stripe_transactions')
      .select('*')
      .eq('session_id', session_id)
      .single()

    if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    if (tx.user_id !== user.id) return NextResponse.json({ error: 'Not your session' }, { status: 403 })

    // Schon completed? Dann nichts tun
    if (tx.status === 'completed') {
      return NextResponse.json({ paid: true, fulfilled: true, coins: tx.coins_awarded })
    }

    // Bei Stripe pruefen ob bezahlt
    const stripe = new Stripe(key, {
      httpClient: Stripe.createFetchHttpClient(),
      maxNetworkRetries: 1,
    })
    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ paid: false, status: session.payment_status })
    }

    // BEZAHLT aber noch pending → Webhook kam nie an → Coins JETZT gutschreiben
    console.log(`[Fulfillment Fallback] Session ${session_id} paid but pending. Fulfilling now.`)

    const product_type = tx.product_type
    const coins = tx.coins_awarded || 0

    if (product_type.startsWith('coin_pack') && coins > 0) {
      await supabase.rpc('add_coins', { p_user_id: user.id, p_amount: coins })
      await supabase.from('wallet_ledger').insert({
        user_id: user.id,
        delta: coins,
        reason: 'purchase_stripe_fallback',
        reference_id: session_id,
      })
    } else if (product_type === 'premium_pass') {
      await supabase.from('user_battlepass').upsert(
        { user_id: user.id, season_id: 1, premium_unlocked: true },
        { onConflict: 'user_id,season_id' }
      )
      await supabase.from('profiles').update({ battle_pass_premium: true }).eq('id', user.id)
    } else if (product_type === 'legendary_box') {
      await supabase.from('reward_box_history').insert({
        user_id: user.id,
        box_type: 'legendary',
        source: 'stripe_purchase',
        opened: false,
        reference_id: session_id,
      })
    }

    // Transaction als completed markieren
    await supabase.from('stripe_transactions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', tx.id)

    return NextResponse.json({ paid: true, fulfilled: true, coins })
  } catch (err: any) {
    console.error('Verify/fulfill error:', err.message)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
