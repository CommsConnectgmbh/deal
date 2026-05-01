import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Force dynamic rendering so env vars are available at runtime, not build time
export const dynamic = 'force-dynamic'
// Use Node.js runtime (not edge) for full Node.js API access
export const runtime = 'nodejs'

/**
 * GET /api/account/export
 *
 * DSGVO Art. 20 (Right to Data Portability) self-service endpoint.
 * Returns the authenticated user's personal data as a JSON download
 * (Content-Disposition attachment).
 *
 * Auth: Bearer access_token from Supabase session.
 *
 * Tables that may not exist in every environment are queried defensively:
 * if a table is missing the field is set to `null` rather than failing the
 * whole export.
 */
export async function GET(req: NextRequest) {
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
  const userEmail = authData.user.email ?? null

  // Helper: query a table by user/owner column, returning [] if missing.
  async function safeSelect<T = Record<string, unknown>>(
    client: SupabaseClient,
    table: string,
    column: string
  ): Promise<T[] | null> {
    try {
      const { data, error } = await client.from(table).select('*').eq(column, userId)
      if (error) {
        // 42P01 = undefined_table, PGRST205 = relation not found
        if (
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          /does not exist/i.test(error.message)
        ) {
          return null
        }
        console.warn(`[account/export] ${table}/${column} error:`, error.message)
        return null
      }
      return (data ?? []) as T[]
    } catch (err) {
      console.warn(`[account/export] ${table} threw:`, err)
      return null
    }
  }

  // 1. Profile (single row)
  const profileResult = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  const userProfile = profileResult.data ?? null

  // 2. Deals (challenges) — both as creator and as opponent.
  const challengesAsCreator = await safeSelect(supabase, 'challenges', 'creator_id')
  const challengesAsOpponent = await safeSelect(supabase, 'challenges', 'opponent_id')
  const deals: Record<string, unknown>[] | null =
    challengesAsCreator !== null || challengesAsOpponent !== null
      ? [...(challengesAsCreator ?? []), ...(challengesAsOpponent ?? [])]
      : null

  // 3. Coins / wallet history (multiple plausible table names)
  const coinsHistory =
    (await safeSelect(supabase, 'coins_history', 'user_id')) ??
    (await safeSelect(supabase, 'coin_transactions', 'user_id')) ??
    (await safeSelect(supabase, 'debt_ledger', 'user_id'))

  // 4. XP events
  const xpEvents = await safeSelect(supabase, 'xp_events', 'user_id')

  // 5. Inventory
  const inventory = await safeSelect(supabase, 'inventory', 'user_id')

  // 6. Notifications
  const notifications = await safeSelect(supabase, 'notifications', 'user_id')

  // 7. Push subscriptions (the user's own — useful for showing what we store)
  const pushSubscriptions = await safeSelect(supabase, 'push_subscriptions', 'user_id')

  // 8. Stripe transactions (purchases ledger)
  const stripeTransactions =
    (await safeSelect(supabase, 'stripe_transactions', 'user_id')) ?? null

  const exportPayload = {
    meta: {
      generated_at: new Date().toISOString(),
      user_id: userId,
      user_email: userEmail,
      app: 'DealBuddy',
      legal_basis: 'GDPR Art. 20 (Right to data portability)',
      contact: 'support@deal-buddy.app',
    },
    user_profile: userProfile,
    deals,
    coins_history: coinsHistory,
    xp_events: xpEvents,
    inventory,
    notifications,
    push_subscriptions: pushSubscriptions,
    stripe_transactions: stripeTransactions,
  }

  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const filename = `dealbuddy-export-${date}.json`

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
