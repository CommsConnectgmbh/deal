'use client'
import React from 'react'
import Link from 'next/link'
import ProfileImage from '@/components/ProfileImage'
import ClickableUsername from '@/components/ClickableUsername'
import { useLang } from '@/contexts/LanguageContext'

/* ─── Types ─── */
export interface FeedEvent {
  id: string
  event_type: string
  deal_id?: string | null
  metadata: Record<string, any>
  created_at: string
  user?: { username: string; display_name: string; avatar_url?: string }
}

export interface AggregatedEvent {
  id: string
  event_type: string
  count: number
  deal_id?: string | null
  latest_created_at: string
  users: Array<{ username: string; display_name?: string; avatar_url?: string }>
  metadata: Record<string, any>
}

export type FeedEventItem = FeedEvent | AggregatedEvent

function isAggregated(e: FeedEventItem): e is AggregatedEvent {
  return 'count' in e && (e as AggregatedEvent).count > 1
}

/* ─── Event config ─── */
type TFunc = (key: string) => string
const EVENT_CONFIG: Record<string, { icon: string; text: (m: Record<string, any>, t: TFunc) => string; color: string; accentBg: string }> = {
  deal_created: {
    icon: '\uD83E\uDD4A',
    text: (m, t) => m.title ? `"${m.title}"` : t('components.feedDealCreated'),
    color: '#FFB800',
    accentBg: 'rgba(255,184,0,0.08)',
  },
  deal_accepted: {
    icon: '\uD83E\uDD1D',
    text: (m, t) => m.title ? t('components.feedDealAcceptedWithTitle').replace('{title}', m.title) : t('components.feedDealAccepted'),
    color: '#4ade80',
    accentBg: 'rgba(74,222,128,0.08)',
  },
  deal_completed: {
    icon: '\uD83C\uDFC6',
    text: (m, t) => m.winner ? t('components.feedDealCompletedWon') : t('components.feedDealCompleted'),
    color: '#22C55E',
    accentBg: 'rgba(34,197,94,0.08)',
  },
  result_proposed: {
    icon: '\uD83D\uDCCB',
    text: (_m, t) => t('components.feedResultProposed'),
    color: '#a78bfa',
    accentBg: 'rgba(167,139,250,0.08)',
  },
  deal_disputed: {
    icon: '\u26A0\uFE0F',
    text: (_m, t) => t('components.feedDealDisputed'),
    color: '#EF4444',
    accentBg: 'rgba(239,68,68,0.08)',
  },
  // Legacy event_type kept so historical feed_events rows still render.
  side_bet_placed: {
    icon: '\uD83C\uDFAF',
    text: (_m, t) => t('components.feedSideChallengePlaced'),
    color: '#FFB800',
    accentBg: 'rgba(255,184,0,0.06)',
  },
  side_challenge_placed: {
    icon: '\uD83C\uDFAF',
    text: (_m, t) => t('components.feedSideChallengePlaced'),
    color: '#FFB800',
    accentBg: 'rgba(255,184,0,0.06)',
  },
  deal_media_added: {
    icon: '\uD83D\uDCF8',
    text: (_m, t) => t('components.feedMediaAdded'),
    color: '#60a5fa',
    accentBg: 'rgba(96,165,250,0.08)',
  },
  level_up: {
    icon: '\u2B06\uFE0F',
    text: (m, t) => t('components.feedLevelUp').replace('{level}', String(m.new_level || '?')),
    color: '#FFB800',
    accentBg: 'rgba(255,184,0,0.1)',
  },
  streak_milestone: {
    icon: '\uD83D\uDD25',
    text: (m, t) => t('components.feedStreakMilestone').replace('{streak}', String(m.streak || '?')),
    color: '#F97316',
    accentBg: 'rgba(249,115,22,0.1)',
  },
  badge_earned: {
    icon: '\uD83C\uDF96',
    text: (m, t) => m.badge_name ? `${m.badge_name} Badge!` : t('components.feedBadgeEarned'),
    color: '#8B5CF6',
    accentBg: 'rgba(139,92,246,0.08)',
  },
  rivalry_update: {
    icon: '\u2694\uFE0F',
    text: (_m, t) => t('components.feedRivalryUpdate'),
    color: '#EF4444',
    accentBg: 'rgba(239,68,68,0.08)',
  },
  tip_result: {
    icon: '\u26BD',
    text: (m, t) => t('components.feedTipResult').replace('{points}', String(m.points || 0)),
    color: '#4ade80',
    accentBg: 'rgba(74,222,128,0.06)',
  },
  tip_exact: {
    icon: '\u26A1',
    text: (m, t) => t('components.feedTipExact').replace('{match}', m.match || ''),
    color: '#FFB800',
    accentBg: 'rgba(255,184,0,0.08)',
  },
  tip_group_created: {
    icon: '\uD83C\uDFC6',
    text: (_m, t) => t('components.feedTipGroupCreated'),
    color: '#60a5fa',
    accentBg: 'rgba(96,165,250,0.08)',
  },
  tip_group_story: {
    icon: '\uD83D\uDCE2',
    text: (m, t) => t('components.feedTipGroupStory').replace('{name}', m.group_name || 'Tippgruppe'),
    color: '#FFB800',
    accentBg: 'rgba(255,184,0,0.06)',
  },
  deal_story: {
    icon: '\uD83D\uDCF1',
    text: (_m, t) => t('components.feedDealStory'),
    color: '#60a5fa',
    accentBg: 'rgba(96,165,250,0.06)',
  },
  profile_post: {
    icon: '\u270D\uFE0F',
    text: (_m, t) => t('components.feedProfilePost'),
    color: '#a78bfa',
    accentBg: 'rgba(167,139,250,0.06)',
  },
  challenge_joined: {
    icon: '\u2694\uFE0F',
    text: (m, t) => m.title ? t('components.feedChallengeJoinedWithTitle').replace('{title}', m.title) : t('components.feedChallengeJoined'),
    color: '#4ade80',
    accentBg: 'rgba(74,222,128,0.08)',
  },
  challenge_invited: {
    icon: '\uD83D\uDCE9',
    text: (m, t) => m.title ? t('components.feedChallengeInvitedWithTitle').replace('{title}', m.title) : t('components.feedChallengeInvited'),
    color: '#f97316',
    accentBg: 'rgba(249,115,22,0.08)',
  },
  winner_declared: {
    icon: '\uD83D\uDC51',
    text: (m, t) => m.winner_name ? t('components.feedWinnerDeclaredWithName').replace('{name}', m.winner_name) : t('components.feedWinnerDeclared'),
    color: '#FFB800',
    accentBg: 'rgba(255,184,0,0.1)',
  },
  rematch_started: {
    icon: '\uD83D\uDD01',
    text: (m, t) => m.title ? t('components.feedRematchWithTitle').replace('{title}', m.title) : t('components.feedRematch'),
    color: '#f97316',
    accentBg: 'rgba(249,115,22,0.08)',
  },
}

/* ─── Helpers ─── */
/* timeAgo moved inside component for i18n */

/* ─── Milestones get special glow treatment ─── */
const MILESTONE_TYPES = new Set(['level_up', 'streak_milestone', 'badge_earned'])

/* ─── Component ─── */
export default function MiniEventCard({ event }: { event: FeedEventItem }) {
  const { t } = useLang()

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return t('components.timeJustNow')
    if (m < 60) return t('components.timeMinutes').replace('{n}', String(m))
    const h = Math.floor(m / 60)
    if (h < 24) return t('components.timeHours').replace('{n}', String(h))
    const d = Math.floor(h / 24)
    return d === 1 ? t('components.timeDaySingular').replace('{n}', String(d)) : t('components.timeDays').replace('{n}', String(d))
  }

  const config = EVENT_CONFIG[event.event_type] || {
    icon: '\uD83D\uDD14',
    text: (_m: Record<string, any>, t: TFunc) => t('components.newEvent'),
    color: 'rgba(240,236,228,0.5)',
    accentBg: 'rgba(255,255,255,0.04)',
  }

  const agg = isAggregated(event) ? event : null
  const isMilestone = MILESTONE_TYPES.has(event.event_type)
  const dealId = event.deal_id || event.metadata?.deal_id
  const dealTitle = event.metadata?.title

  const card = (
    <div style={{
      background: isMilestone ? config.accentBg : '#111',
      borderRadius: 12,
      padding: isMilestone ? '12px 12px 12px 14px' : '10px 12px 10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      borderLeft: `2px solid ${config.color}`,
      border: isMilestone ? `1px solid ${config.color}30` : undefined,
      borderLeftWidth: isMilestone ? 2 : 2,
      borderLeftStyle: 'solid' as const,
      borderLeftColor: config.color,
      position: 'relative' as const,
      overflow: 'hidden',
    }}>
      {/* Milestone glow */}
      {isMilestone && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at 0% 50%, ${config.color}15, transparent 60%)`,
        }} />
      )}

      {/* Avatar(s) */}
      {agg ? (
        <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
          {agg.users.slice(0, 3).map((u, i) => (
            <div key={i} style={{
              position: i === 0 ? 'relative' as const : 'absolute' as const,
              top: i === 0 ? 0 : -2,
              left: i * 10,
              zIndex: 3 - i,
            }}>
              <ProfileImage size={i === 0 ? 28 : 20} avatarUrl={u.avatar_url} name={u.display_name || u.username} />
            </div>
          ))}
        </div>
      ) : (
        <ProfileImage
          size={32}
          avatarUrl={!agg ? (event as FeedEvent).user?.avatar_url : undefined}
          name={!agg ? ((event as FeedEvent).user?.display_name || (event as FeedEvent).user?.username) : undefined}
        />
      )}

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#F0ECE4', fontSize: 12, margin: 0, lineHeight: 1.4 }}>
          {agg ? (
            <>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                color: config.color, fontSize: 12,
              }}>
                {agg.count} {(event.event_type === 'side_bet_placed' || event.event_type === 'side_challenge_placed') ? t('components.newTips') : t('components.events')}
              </span>
              {dealTitle && (
                <span style={{ color: 'rgba(240,236,228,0.6)' }}>
                  {' '}{t('components.onDeal').replace('{title}', dealTitle)}
                </span>
              )}
            </>
          ) : (
            <>
              {(event as FeedEvent).user && (
                <ClickableUsername
                  username={(event as FeedEvent).user!.username}
                  displayName={(event as FeedEvent).user!.display_name}
                  showAt
                  fontSize={12}
                  color={config.color}
                  fontWeight={700}
                />
              )}
              <span style={{ color: 'rgba(240,236,228,0.7)' }}>
                {' '}{config.text(event.metadata || {}, t)}
              </span>
            </>
          )}
        </p>

        {/* Deal-Titel als Subtext (wenn nicht schon im text enthalten) */}
        {dealTitle && !agg && !['deal_created', 'deal_accepted'].includes(event.event_type) && (
          <p style={{
            color: '#FFB800', fontSize: 10, margin: '2px 0 0',
            fontFamily: 'var(--font-body)', opacity: 0.7,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {dealTitle}
          </p>
        )}

        {/* Timestamp */}
        <p style={{ color: 'rgba(240,236,228,0.3)', fontSize: 10, margin: '2px 0 0', fontFamily: 'var(--font-body)' }}>
          {timeAgo(agg ? agg.latest_created_at : (event as FeedEvent).created_at)}
        </p>
      </div>

      {/* Icon */}
      <span style={{
        fontSize: isMilestone ? 22 : 18, flexShrink: 0,
        filter: isMilestone ? `drop-shadow(0 0 6px ${config.color}40)` : 'none',
      }}>
        {config.icon}
      </span>
    </div>
  )

  // Wrap in Link if deal_id exists
  if (dealId) {
    return (
      <Link href={`/app/deals/${dealId}`} style={{ textDecoration: 'none', display: 'block' }}>
        {card}
      </Link>
    )
  }

  return card
}

/* ─── Aggregation Utility ─── */
export function aggregateFeedEvents(events: FeedEvent[]): FeedEventItem[] {
  // Never aggregate milestone events
  const NEVER_AGGREGATE = new Set(['level_up', 'streak_milestone', 'badge_earned', 'deal_completed', 'deal_created', 'deal_accepted', 'deal_disputed', 'result_proposed', 'deal_media_added', 'deal_story', 'profile_post', 'tip_group_story', 'tip_group_created', 'challenge_joined', 'challenge_invited', 'winner_declared', 'rematch_started'])

  const aggregatable = events.filter(e => !NEVER_AGGREGATE.has(e.event_type))
  const singles = events.filter(e => NEVER_AGGREGATE.has(e.event_type))

  // Group by event_type + deal_id within 4h windows
  const groups: Record<string, FeedEvent[]> = {}
  for (const ev of aggregatable) {
    const window = Math.floor(new Date(ev.created_at).getTime() / (4 * 3600000))
    const key = `${ev.event_type}:${ev.deal_id || 'global'}:${window}`
    if (!groups[key]) groups[key] = []
    groups[key].push(ev)
  }

  const result: FeedEventItem[] = [...singles]

  for (const [, group] of Object.entries(groups)) {
    if (group.length === 1) {
      result.push(group[0])
    } else {
      // Aggregate
      const sorted = group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const users = sorted
        .filter(e => e.user)
        .map(e => ({
          username: e.user!.username,
          display_name: e.user!.display_name,
          avatar_url: e.user!.avatar_url,
        }))
      // Deduplicate users
      const seen = new Set<string>()
      const uniqueUsers = users.filter(u => {
        if (seen.has(u.username)) return false
        seen.add(u.username)
        return true
      })

      result.push({
        id: sorted[0].id,
        event_type: sorted[0].event_type,
        count: group.length,
        deal_id: sorted[0].deal_id,
        latest_created_at: sorted[0].created_at,
        users: uniqueUsers,
        metadata: sorted[0].metadata,
      })
    }
  }

  // Sort by date (newest first)
  return result.sort((a, b) => {
    const dateA = 'latest_created_at' in a ? (a as AggregatedEvent).latest_created_at : (a as FeedEvent).created_at
    const dateB = 'latest_created_at' in b ? (b as AggregatedEvent).latest_created_at : (b as FeedEvent).created_at
    return new Date(dateB).getTime() - new Date(dateA).getTime()
  })
}
