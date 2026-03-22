import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { betId, status } = await req.json()

    // Validate status
    if (!['fulfilled', 'unfulfilled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be fulfilled or unfulfilled.' }, { status: 400 })
    }

    // Fetch fulfillment record
    const { data: bf, error: bfErr } = await supabaseAdmin
      .from('bet_fulfillment')
      .select('*')
      .eq('bet_id', betId)
      .single()

    if (bfErr || !bf) {
      return NextResponse.json({ error: 'Fulfillment record not found' }, { status: 404 })
    }

    // Only the entitled user (winner) can confirm
    if (bf.entitled_user_id !== user.id) {
      return NextResponse.json({ error: 'Only the winner can confirm fulfillment' }, { status: 403 })
    }

    // Only pending records can be updated
    if (bf.status !== 'pending_fulfillment') {
      return NextResponse.json({ error: 'Fulfillment already resolved' }, { status: 400 })
    }

    // Verify the deal is completed
    const { data: bet } = await supabaseAdmin
      .from('bets')
      .select('status')
      .eq('id', betId)
      .single()

    if (!bet || bet.status !== 'completed') {
      return NextResponse.json({ error: 'Deal is not completed' }, { status: 400 })
    }

    // Update fulfillment status (triggers recalc_reliability)
    const { error: updateErr } = await supabaseAdmin
      .from('bet_fulfillment')
      .update({
        status,
        confirmed_by_user_id: user.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', bf.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
