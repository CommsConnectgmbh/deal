import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Extract and verify user from Authorization header */
async function getAuthUser(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !user) return null
  return user
}

/**
 * POST /api/push/subscribe — Store push subscription
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subscription } = await req.json()
    if (!subscription) {
      return NextResponse.json({ error: 'Missing subscription' }, { status: 400 })
    }

    const { error } = await getSupabaseAdmin()
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh,
        auth_key: subscription.keys?.auth,
        subscription_json: JSON.stringify(subscription),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,endpoint' })

    if (error) {
      console.error('Push subscription save error:', error)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/push/subscribe — Remove push subscription
 */
export async function DELETE(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await getSupabaseAdmin()
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
