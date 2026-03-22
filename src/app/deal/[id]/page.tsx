import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import DealPreviewClient from './DealPreviewClient'

/* ─── Server-side Supabase (service role for public access) ─── */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/* ─── Status labels ─── */
const STATUS_LABELS: Record<string, string> = {
  open: 'OFFEN', pending: 'EINGELADEN', active: 'AKTIV',
  pending_confirmation: 'BESTÄTIGUNG', completed: 'ABGESCHLOSSEN',
  cancelled: 'ABGEBROCHEN', disputed: 'DISPUTE', frozen: 'EINGEFROREN',
}

/* ─── Fetch deal data ─── */
async function getDeal(id: string) {
  const { data } = await supabaseAdmin
    .from('bets')
    .select(`
      id, title, stake, status, deadline, created_at, is_public,
      creator_id, opponent_id, winner_id, confirmed_winner_id,
      creator:profiles!bets_creator_id_fkey(username, display_name, avatar_url),
      opponent:profiles!bets_opponent_id_fkey(username, display_name, avatar_url)
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

  const creatorName = (deal.creator as any)?.display_name || (deal.creator as any)?.username || 'Jemand'
  const opponentName = (deal.opponent as any)?.display_name || (deal.opponent as any)?.username || null
  const vs = opponentName ? `${creatorName} vs ${opponentName}` : `${creatorName} sucht einen Gegner`
  const statusLabel = STATUS_LABELS[deal.status] || deal.status
  const description = `${vs} · Einsatz: ${deal.stake} · Status: ${statusLabel}`

  return {
    title: `${deal.title} | DealBuddy`,
    description,
    openGraph: {
      title: `⚔️ ${deal.title}`,
      description,
      type: 'website',
      url: `https://app.deal-buddy.app/deal/${id}`,
      siteName: 'DealBuddy',
    },
    twitter: {
      card: 'summary',
      title: `⚔️ ${deal.title}`,
      description,
    },
  }
}

/* ─── Page Component ─── */
export default async function DealPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deal = await getDeal(id)

  if (!deal) {
    redirect('/auth/login')
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
