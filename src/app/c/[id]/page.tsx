import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import ChallengePreviewClient from './ChallengePreviewClient'

/* ─── Server-side Supabase (service role for public access) ─── */
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/* ─── Fetch challenge data ─── */
async function getChallenge(id: string) {
  const { data } = await getSupabaseAdmin()
    .from('challenges')
    .select(`
      id, title, description, stake, status, deadline, expires_at, created_at,
      is_public, creator_amount, opponent_amount,
      creator_id, opponent_id,
      creator:profiles!challenges_creator_id_fkey(username, display_name, avatar_url, reliability_score),
      opponent:profiles!challenges_opponent_id_fkey(username, display_name, avatar_url, reliability_score)
    `)
    .eq('id', id)
    .single()
  return data
}

/* ─── Dynamic OG Metadata für Social Sharing ─── */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const challenge = await getChallenge(id)
  if (!challenge) {
    return { title: 'Challenge nicht gefunden | DealBuddy' }
  }

  const creator = challenge.creator as any
  const creatorName = creator?.display_name || creator?.username || 'Jemand'
  const amount = challenge.creator_amount
    ? `${(challenge.creator_amount / 100).toFixed(0)}€`
    : challenge.stake || 'Ehre'
  const ogTitle = `${creatorName} hat dich zu einem Deal herausgefordert!`
  const ogDescription = amount

  return {
    title: `${challenge.title} | DealBuddy Challenge`,
    description: `${creatorName} fordert dich heraus! Einsatz: ${amount}`,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: 'website',
      url: `https://app.deal-buddy.app/c/${id}`,
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
export default async function ChallengeLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const challenge = await getChallenge(id)

  if (!challenge) {
    redirect('/')
  }

  const creator = challenge.creator as any
  const opponent = challenge.opponent as any
  const deadline = challenge.expires_at || challenge.deadline
  const amount = challenge.creator_amount
    ? `${(challenge.creator_amount / 100).toFixed(0)}€`
    : challenge.stake || 'Ehre'

  return (
    <ChallengePreviewClient
      challenge={{
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        amount,
        status: challenge.status,
        isOpen: challenge.status === 'open' && !challenge.opponent_id,
        deadline: deadline ? new Date(deadline).toLocaleDateString('de-DE', {
          day: '2-digit', month: 'short', year: 'numeric'
        }) : null,
        creator: creator ? {
          username: creator.username,
          displayName: creator.display_name,
          reliabilityScore: creator.reliability_score,
        } : null,
        opponent: opponent ? {
          username: opponent.username,
          displayName: opponent.display_name,
        } : null,
      }}
    />
  )
}
