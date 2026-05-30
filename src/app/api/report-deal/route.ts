import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Escape user-controlled values before interpolating into HTML email.
function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    // ── Auth: verify the Bearer token, derive reporter from the session ──
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const reporterId = user.id

    const { dealId, reason } = await req.json()
    if (!dealId || !reason) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Validate dealId shape (UUID) to avoid junk reports.
    if (!/^[0-9a-f-]{36}$/i.test(String(dealId))) {
      return NextResponse.json({ error: 'Invalid dealId' }, { status: 400 })
    }

    // ── Rate limit: cap reports per user per 24h to curb mail spam ──
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await supabaseAdmin
      .from('deal_reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', reporterId)
      .gte('created_at', since)

    if ((recentCount ?? 0) > 20) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Fetch reporter username
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', reporterId)
      .single()

    const reporterName = profile?.username || reporterId

    const reasonLabels: Record<string, string> = {
      spam: 'Spam',
      offensive: 'Beleidigend / Offensive',
      fraud: 'Betrug / Fraud',
      other: 'Sonstiges / Other',
    }
    const reasonLabel = reasonLabels[reason] || 'Sonstiges / Other'

    const timestamp = new Date().toISOString()
    const safeDealId = escapeHtml(dealId)
    const safeReporter = escapeHtml(reporterName)
    const safeReporterId = escapeHtml(reporterId)

    // Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'DealBuddy <noreply@deal-buddy.app>',
        to: ['info@deal-buddy.app'],
        subject: `[Report] Deal ${String(dealId).slice(0, 8)}... - ${reasonLabel}`,
        html: `
          <h2>Deal Report</h2>
          <table style="border-collapse:collapse;">
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Deal ID:</td><td>${safeDealId}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Reporter:</td><td>${safeReporter} (${safeReporterId})</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Reason:</td><td>${escapeHtml(reasonLabel)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Timestamp:</td><td>${escapeHtml(timestamp)}</td></tr>
          </table>
          <p style="margin-top:16px;">
            <a href="https://app.deal-buddy.app/app/deals/${encodeURIComponent(String(dealId))}">View Deal</a>
          </p>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Report deal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
