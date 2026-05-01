import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    // Verify auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Accept both `challengeId` (new) and `betId` (legacy) from clients.
    const body = await req.json()
    const challengeId: string | undefined = body.challengeId ?? body.betId
    const status: string = body.status

    // Validate status
    if (!['fulfilled', 'unfulfilled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be fulfilled or unfulfilled.' }, { status: 400 })
    }
    if (!challengeId) {
      return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 })
    }

    // Fetch fulfillment record
    const { data: cf, error: cfErr } = await supabaseAdmin
      .from('challenge_fulfillment')
      .select('*')
      .eq('bet_id', challengeId)
      .single()

    if (cfErr || !cf) {
      return NextResponse.json({ error: 'Fulfillment record not found' }, { status: 404 })
    }

    // Only the entitled user (winner) can confirm
    if (cf.entitled_user_id !== user.id) {
      return NextResponse.json({ error: 'Only the winner can confirm fulfillment' }, { status: 403 })
    }

    // Only pending records can be updated
    if (cf.status !== 'pending_fulfillment') {
      return NextResponse.json({ error: 'Fulfillment already resolved' }, { status: 400 })
    }

    // Verify the challenge is completed
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('status')
      .eq('id', challengeId)
      .single()

    if (!challenge || challenge.status !== 'completed') {
      return NextResponse.json({ error: 'Deal is not completed' }, { status: 400 })
    }

    // Update fulfillment status (triggers recalc_reliability)
    const { error: updateErr } = await supabaseAdmin
      .from('challenge_fulfillment')
      .update({
        status,
        confirmed_by_user_id: user.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', cf.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
