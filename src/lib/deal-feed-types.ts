/* ═══════════════════════════════════════════════════════════════
   deal-feed-types — Shared types, constants & helpers for the
   Home Feed. Centralizes Deal interface, status colors, badge
   config and card-type determination.
   ═══════════════════════════════════════════════════════════════ */

/* ─── Status types ─── */
export type DealStatus =
  | 'open'
  | 'pending'
  | 'active'
  | 'pending_confirmation'
  | 'completed'
  | 'cancelled'
  | 'disputed'

export type DealCardType =
  | 'live_duel'
  | 'open_challenge'
  | 'invited'
  | 'completed'

/* ─── Participant (creator / opponent sub-select) ─── */
export interface DealParticipant {
  id?: string
  username: string
  display_name: string
  level?: number
  streak?: number
  active_frame?: string | null
  is_founder?: boolean
  avatar_url?: string
  equipped_card_image_url?: string | null
}

/* ─── FeedDeal — superset used by all feed cards ─── */
export interface FeedDeal {
  id: string
  title: string
  stake: string
  status: string // DealStatus — kept as string for Supabase compat
  category?: string
  is_public?: boolean
  created_at: string
  deadline?: string | null
  creator_id: string
  opponent_id?: string | null
  confirmed_winner_id?: string | null
  winner_id?: string | null
  proposed_winner_id?: string | null
  winner_proposed_by?: string | null
  media_url?: string | null
  media_type?: string | null
  creator: DealParticipant | null
  opponent: DealParticipant | null
}

/* ─── Determine card type from deal + current user ─── */
export function getDealCardType(deal: FeedDeal, userId: string): DealCardType {
  const s = deal.status
  // Active duels (running or pending result confirmation)
  if (s === 'active' || s === 'pending_confirmation') return 'live_duel'
  // Completed
  if (s === 'completed' || s === 'cancelled' || s === 'disputed') return 'completed'
  // Pending invite where current user is the opponent
  if (s === 'pending' && deal.opponent_id === userId) return 'invited'
  // Open challenge (no opponent yet)
  if (s === 'open' && !deal.opponent_id) return 'open_challenge'
  // Fallback for edge cases (pending where user is creator, open with opponent, etc.)
  if (s === 'open' || s === 'pending') return 'open_challenge'
  return 'open_challenge'
}

/* ─── Status colors (centralized) ─── */
export const STATUS_COLORS: Record<string, string> = {
  open:                 '#FFB800',
  pending:              '#f97316',
  active:               '#4ade80',
  pending_confirmation: '#a78bfa',
  completed:            '#60a5fa',
  cancelled:            '#f87171',
  disputed:             '#ef4444',
}

/* ─── Status labels (i18n key references) ─── */
export const STATUS_LABEL_KEYS: Record<string, string> = {
  open:                 'components.statusOpen',
  pending:              'components.statusInvited',
  active:               'components.statusLiveDuel',
  pending_confirmation: 'components.statusConfirmation',
  completed:            'components.statusCompleted',
  cancelled:            'components.statusCancelled',
  disputed:             'components.statusDispute',
}

/** @deprecated Use STATUS_LABEL_KEYS with t() instead */
export const STATUS_LABELS: Record<string, string> = {
  open:                 'OFFEN',
  pending:              'EINGELADEN',
  active:               '\u26A1 LIVE DUEL',
  pending_confirmation: 'BEST\u00C4TIGUNG',
  completed:            'ABGESCHLOSSEN',
  cancelled:            'ABGEBROCHEN',
  disputed:             'STREIT',
}

/** Build localized status labels using a t() function */
export function getStatusLabels(t: (key: string) => string): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const [k, v] of Object.entries(STATUS_LABEL_KEYS)) {
    labels[k] = t(v)
  }
  return labels
}

/* ─── Badge config (5 standardized badges) ─── */
export const BADGE_CONFIG = {
  LIVE_DUEL:      { label: '\u26A1 LIVE DUEL',   labelKey: 'components.statusLiveDuel',       color: '#4ade80', glow: 'rgba(74,222,128,0.3)' },
  OFFEN:          { label: 'OFFEN',               labelKey: 'components.statusOpen',            color: '#FFB800', glow: 'rgba(255,184,0,0.25)' },
  GEGNER_GESUCHT: { label: 'GEGNER GESUCHT',     labelKey: 'components.badgeOpponentSearched', color: '#FFB800', glow: 'rgba(255,184,0,0.25)' },
  EINGELADEN:     { label: 'EINGELADEN',          labelKey: 'components.statusInvited',         color: '#f97316', glow: 'rgba(249,115,22,0.3)' },
  ABGESCHLOSSEN:  { label: 'ABGESCHLOSSEN',      labelKey: 'components.statusCompleted',       color: '#60a5fa', glow: 'rgba(96,165,250,0.2)' },
  BESTAETIGUNG:   { label: 'BEST\u00C4TIGUNG',   labelKey: 'components.statusConfirmation',    color: '#a78bfa', glow: 'rgba(167,139,250,0.25)' },
  STREIT:         { label: 'STREIT',              labelKey: 'components.statusDispute',         color: '#ef4444', glow: 'rgba(239,68,68,0.25)' },
} as const

export type BadgeType = keyof typeof BADGE_CONFIG

/* ─── Map DealCardType to badge ─── */
export function getBadgeForDeal(deal: FeedDeal, userId: string): BadgeType {
  const ct = getDealCardType(deal, userId)
  switch (ct) {
    case 'live_duel':
      return deal.status === 'pending_confirmation' ? 'BESTAETIGUNG' : 'LIVE_DUEL'
    case 'open_challenge':
      return deal.opponent_id ? 'OFFEN' : 'GEGNER_GESUCHT'
    case 'invited':
      return 'EINGELADEN'
    case 'completed':
      return deal.status === 'disputed' ? 'STREIT' : 'ABGESCHLOSSEN'
  }
}

/* ─── Shared DealCard props interface ─── */
export interface DealCardProps {
  deal: FeedDeal
  expanded: boolean
  onToggleExpand: () => void
  feedEvents: any[]
  feedMedia: Record<string, any[]>
  challengeQuotes: Record<string, { a: number; b: number }>
  onCommentOpen: (dealId: string) => void
  userId: string
  onHide?: (dealId: string) => void
}

/* ─── timeAgo helper (i18n-ready) ─── */
/** @deprecated Use timeAgoI18n with t() instead */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `vor ${m} Min.`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h} Std.`
  const d = Math.floor(h / 24)
  return `vor ${d} Tag${d !== 1 ? 'en' : ''}`
}

/** Localized timeAgo — pass t() from useLang() */
export function timeAgoI18n(dateStr: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('components.timeJustNow')
  if (m < 60) return t('components.timeMinutes').replace('{n}', String(m))
  const h = Math.floor(m / 60)
  if (h < 24) return t('components.timeHours').replace('{n}', String(h))
  const d = Math.floor(h / 24)
  return d === 1 ? t('components.timeDaySingular').replace('{n}', String(d)) : t('components.timeDays').replace('{n}', String(d))
}
