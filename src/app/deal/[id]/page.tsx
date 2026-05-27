import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import type { Metadata } from 'next'
import DealPreviewClient from './DealPreviewClient'

/* ─── Server-side Supabase (service role for public access) ─── */
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/* ─── Status labels ─── */
const STATUS_LABELS: Record<string, string> = {
  open: 'OFFEN', pending: 'EINGELADEN', active: 'AKTIV',
  pending_confirmation: 'BESTÄTIGUNG', completed: 'ABGESCHLOSSEN',
  cancelled: 'ABGEBROCHEN', disputed: 'DISPUTE', frozen: 'EINGEFROREN',
}

/* ─── Fetch deal data ─── */
async function getDeal(id: string) {
  const { data } = await getSupabaseAdmin()
    .from('challenges')
    .select(`
      id, title, stake, status, deadline, created_at, is_public,
      creator_id, opponent_id, winner_id, confirmed_winner_id,
      creator:profiles!challenges_creator_id_fkey(username, display_name, avatar_url),
      opponent:profiles!challenges_opponent_id_fkey(username, display_name, avatar_url)
    `)
    .eq('id', id)
    .single()
  return data
}

/* ─── Dynamic OG Metadata ─── */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const deal = await getDeal(id)
  if (!deal) {
    return { title: 'Deal nicht gefunden | DealBuddy' }
  }

  const creator = deal.creator as any
  const creatorName = creator?.display_name || creator?.username || 'Jemand'
  const opponentName = (deal.opponent as any)?.display_name || (deal.opponent as any)?.username || null
  const ogTitle = `${creatorName} hat dich zu einem Deal herausgefordert!`
  const ogDescription = deal.stake || 'Ehre'

  return {
    title: `${deal.title} | DealBuddy`,
    description: opponentName
      ? `${creatorName} vs ${opponentName} · Einsatz: ${deal.stake}`
      : `${creatorName} sucht einen Gegner · Einsatz: ${deal.stake}`,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: 'website',
      url: `https://app.deal-buddy.app/deal/${id}`,
      siteName: 'DealBuddy',
      images: creator?.avatar_url
        ? [{ url: creator.avatar_url, width: 512, height: 512, alt: `${creatorName} Battle Card` }]
        : [{ url: 'https://app.deal-buddy.app/opengraph-image', width: 1200, height: 630, alt: 'DealBuddy' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: creator?.avatar_url ? [creator.avatar_url] : ['https://app.deal-buddy.app/opengraph-image'],
    },
  }
}

/* ─── Page Component ─── */
export default async function DealPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deal = await getDeal(id)

  if (!deal) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
        maxWidth: 430,
        margin: '0 auto',
      }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🔍</div>
        <h1 style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: 28,
          color: 'var(--gold-primary)',
          letterSpacing: 2,
          marginBottom: 12,
          textTransform: 'uppercase',
        }}>
          Deal nicht gefunden
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5, marginBottom: 32, maxWidth: 320 }}>
          Diese Challenge existiert nicht oder wurde bereits entfernt. Vielleicht ist der Link abgelaufen?
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-bright) 100%)',
            color: 'var(--text-inverse)',
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 2,
            textTransform: 'uppercase',
            padding: '14px 32px',
            borderRadius: 12,
            textDecoration: 'none',
          }}
        >
          Zur Startseite
        </Link>
      </div>
    )
  }

  const creator = deal.creator as any
  const opponent = deal.opponent as any
  const statusLabel = STATUS_LABELS[deal.status] || deal.status

  // Determine winner for completed deals
  let winnerName: string | null = null
  if (deal.status === 'completed') {
    const winnerId = deal.confirmed_winner_id || deal.winner_id
    if (winnerId === deal.creator_id) winnerName = creator?.display_name || creator?.username
    else if (winnerId === deal.opponent_id) winnerName = opponent?.display_name || opponent?.username
  }

  return (
    <DealPreviewClient
      deal={{
        id: deal.id,
        title: deal.title,
        stake: deal.stake,
        status: deal.status,
        statusLabel,
        deadline: deal.deadline,
        createdAt: deal.created_at,
        creator: creator ? { username: creator.username, displayName: creator.display_name } : null,
        opponent: opponent ? { username: opponent.username, displayName: opponent.display_name } : null,
        winnerName,
      }}
    />
  )
}
