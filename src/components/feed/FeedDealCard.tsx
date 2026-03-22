'use client'
import { getDealCardType, type DealCardProps } from '@/lib/deal-feed-types'
import LiveDuelCard from './LiveDuelCard'
import OpenChallengeCard from './OpenChallengeCard'
import InvitedChallengeCard from './InvitedChallengeCard'
import CompletedChallengeCard from './CompletedChallengeCard'

/* ═══════════════════════════════════════════════════════════════
   FeedDealCard — Dispatcher that renders the correct card type
   based on deal status + current user context
   ═══════════════════════════════════════════════════════════════ */
export default function FeedDealCard(props: DealCardProps) {
  const cardType = getDealCardType(props.deal, props.userId)

  switch (cardType) {
    case 'live_duel':
      return <LiveDuelCard {...props} />
    case 'open_challenge':
      return <OpenChallengeCard {...props} />
    case 'invited':
      return <InvitedChallengeCard {...props} />
    case 'completed':
      return <CompletedChallengeCard {...props} />
    default:
      return <OpenChallengeCard {...props} />
  }
}
