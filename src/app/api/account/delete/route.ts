import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering so env vars are available at runtime, not build time
export const dynamic = 'force-dynamic'
// Use Node.js runtime (not edge) for full Node.js API access
export const runtime = 'nodejs'

/**
 * POST /api/account/delete
 *
 * Server-side account soft-delete endpoint.
 * Anonymizes profile fields and signs the user out.
 * Required for Apple Guideline 5.1.1(v) (in-app account deletion).
 *
 * Auth: Bearer access_token from Supabase session.
 */
export async function POST(req: NextRequest) {
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

  const userId = authData.user.id

  try {
    // Soft delete: anonymize profile (mirrors PWA settings page logic)
    const anonymizedUsername = `deleted_${userId.slice(0, 8)}`
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: 'Geloeschter Nutzer',
        username: anonymizedUsername,
        bio: null,
        avatar_url: null,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[account/delete] profile update error:', updateError)
      return NextResponse.json({ error: 'Profile update failed' }, { status: 500 })
    }

    // Best-effort: clean push subscriptions so anonymized account stops getting notified
    await supabase.from('push_subscriptions').delete().eq('user_id', userId)

    // Revoke all refresh tokens server-side (forces sign-out across devices)
    const { error: signOutError } = await supabase.auth.admin.signOut(token)
    if (signOutError) {
      // Non-fatal: profile is already anonymized; client will still call signOut() locally.
      console.warn('[account/delete] admin signOut warning:', signOutError.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[account/delete] error:', message)
    return NextResponse.json({ error: 'Account deletion failed' }, { status: 500 })
  }
}
