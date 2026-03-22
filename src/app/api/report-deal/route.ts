import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { dealId, reason, reporterId } = await req.json()

    if (!dealId || !reason || !reporterId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
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

    const timestamp = new Date().toISOString()

    // Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'DealBuddy <noreply@deal-buddy.app>',
        to: ['support@deal-buddy.de'],
        subject: `[Report] Deal ${dealId.slice(0, 8)}... - ${reasonLabels[reason] || reason}`,
        html: `
          <h2>Deal Report</h2>
          <table style="border-collapse:collapse;">
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Deal ID:</td><td>${dealId}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Reporter:</td><td>${reporterName} (${reporterId})</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Reason:</td><td>${reasonLabels[reason] || reason}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Timestamp:</td><td>${timestamp}</td></tr>
          </table>
          <p style="margin-top:16px;">
            <a href="https://app.deal-buddy.app/app/deals/${dealId}">View Deal</a>
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
