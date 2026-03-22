'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLang } from '@/contexts/LanguageContext'
import DealCardMenu from '@/components/DealCardMenu'

/* ─── Constants ─── */
const STATUS_COLORS: Record<string, string> = {
  open:                 '#FFB800',
  pending:              '#f97316',
  active:               '#4ade80',
  pending_confirmation: '#a78bfa',
  completed:            '#60a5fa',
  cancelled:            '#f87171',
  disputed:             '#ef4444',
}
const getStatusLabels = (t: (key: string) => string): Record<string, string> => ({
  open:                 t('status.open'),
  pending:              t('status.invited'),
  active:               t('status.live'),
  pending_confirmation: t('status.confirmation'),
  completed:            t('status.completed'),
  cancelled:            t('status.cancelled'),
  disputed:             t('status.disputed'),
})

/* ─── Card Placeholder (CSS-only) ─── */
const CardPlaceholder = ({ dimmed }: { dimmed?: boolean }) => (
  <div style={{
    width: '100%', height: '100%',
    background: 'linear-gradient(135deg, rgba(255,184,0,0.1), rgba(255,184,0,0.02))',
    border: '1px solid rgba(255,184,0,0.2)',
    borderRadius: 10,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    opacity: dimmed ? 0.35 : 0.7,
  }}>
    <span style={{ fontSize: 26, color: 'rgba(255,184,0,0.4)' }}>{'\u{1F3B4}'}</span>
  </div>
)

/* ─── Countdown helper ─── */
function useCountdown(deadline: string | null | undefined, t: (key: string) => string) {
  const [remaining, setRemaining] = useState('')
  const [isExpired, setIsExpired] = useState(false)
  const [isUrgent, setIsUrgent] = useState(false)
  useEffect(() => {
    if (!deadline) return
    const tick = () => {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) { setRemaining(t('deals.expired')); setIsExpired(true); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setIsUrgent(diff < 3600000)
      if (d > 0) setRemaining(t('deals.endsInDays').replace('{n}', String(d)))
      else if (h > 0) setRemaining(t('deals.hoursLeft').replace('{n}', String(h)))
      else setRemaining(t('deals.minutesLeft').replace('{n}', String(m)))
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [deadline, t])
  return { remaining, isExpired, isUrgent }
}

interface Deal {
  id: string
  title: string
  stake: string
  status: string
  category?: string
  is_public?: boolean
  created_at: string
  deadline?: string | null
  creator_id: string
  opponent_id?: string
  confirmed_winner_id?: string
  creator: { id?: string; username: string; display_name: string; level?: number; streak?: number; active_frame?: string | null; is_founder?: boolean; avatar_url?: string; equipped_card_image_url?: string | null } | null
  opponent: { id?: string; username: string; display_name: string; level?: number; streak?: number; active_frame?: string | null; is_founder?: boolean; avatar_url?: string; equipped_card_image_url?: string | null } | null
}

interface Props {
  deal: Deal
  tipCount?: number
  commentCount?: number
}

/* ═══════════════════════════════════════════════════════════════
   FeedVSCard — Boxing Arena style VS card (pure CSS, no bg image)
   Layout: Title → Arena (Cards + VS) → Info Bar
   ═══════════════════════════════════════════════════════════════ */
export default function FeedVSCard({ deal, tipCount = 0, commentCount = 0 }: Props) {
  const { t } = useLang()
  const { remaining, isExpired, isUrgent } = useCountdown(deal.deadline, t)
  const sc = STATUS_COLORS[deal.status] || '#888'
  const sl = getStatusLabels(t)[deal.status] || deal.status.toUpperCase()
  const isCompleted = deal.status === 'completed'
  const isDisputed = deal.status === 'disputed'
  const isWon = isCompleted && deal.confirmed_winner_id
  const creatorWon = isWon && deal.confirmed_winner_id === deal.creator_id
  const opponentWon = isWon && deal.confirmed_winner_id === deal.opponent_id

  const creatorCardUrl = deal.creator?.equipped_card_image_url
  const opponentCardUrl = deal.opponent?.equipped_card_image_url

  // ─── Story text for narrative context ───
  const creatorUser = deal.creator?.username || '?'
  const opponentUser = deal.opponent?.username || '???'
  const winnerName = isWon
    ? (deal.confirmed_winner_id === deal.creator_id ? creatorUser : opponentUser)
    : ''
  // ─── Build dynamic activity hints ───
  const activityHints: string[] = []
  if (tipCount > 0) activityHints.push(`${tipCount} ${tipCount === 1 ? t('feed.tip') : t('feed.tips')}`)
  if (commentCount > 0) activityHints.push(`${commentCount} ${commentCount === 1 ? t('feed.comment') : t('feed.comments')}`)
  const activityStr = activityHints.length > 0 ? activityHints.join(' \u00B7 ') : ''

  const storyText = (() => {
    if (isCompleted && winnerName) return `\uD83C\uDFC6 ${t('feed.wonDuel').replace('{name}', winnerName)}`
    if (isDisputed) return `\u26A0\uFE0F ${t('feed.resultDisputed')}`
    if (deal.status === 'pending') {
      const deadline = remaining ? ` \u00B7 ${remaining}` : ''
      return `${creatorUser} fordert ${opponentUser} heraus${deadline}`
    }
    if (deal.status === 'active') {
      const parts: string[] = []
      if (remaining) parts.push(remaining)
      if (activityStr) parts.push(activityStr)
      return parts.length > 0 ? `${t('feed.battleRunning')} \u00B7 ${parts.join(' \u00B7 ')}` : t('feed.battleRunning')
    }
    if (deal.status === 'open' && !deal.opponent) return `${creatorUser} ${t('status.searchingOpponent')}`
    if (deal.status === 'pending_confirmation') {
      return activityStr ? `${t('feed.resultReported')} \u00B7 ${activityStr}` : t('feed.resultReported')
    }
    return remaining || ''
  })()

  return (
    <Link href={`/app/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{ background: '#111', overflow: 'hidden', cursor: 'pointer' }}>

        {/* ═══════════════════════════════════════════
            ARENA — deal.jpg background + overlay
            ═══════════════════════════════════════════ */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          backgroundImage: 'url(/deal.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          overflow: 'hidden',
        }}>
          {/* Subtle overlay — keep deal.jpg visible */}
          <div style={{
            position: 'absolute', inset: 0,
            background: isDisputed
              ? 'rgba(239,68,68,0.1)'
              : isCompleted
                ? 'rgba(96,165,250,0.06)'
                : 'rgba(0,0,0,0.15)',
            pointerEvents: 'none',
          }} />
          {/* Bottom fade for info bar readability */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(17,17,17,0.9) 100%)',
            pointerEvents: 'none', zIndex: 1,
          }} />

          {/* Subtle vignette overlay */}

          {/* ── 3-DOT MENU — top right ── */}
          <div style={{ position: 'absolute', top: 18, right: 10, zIndex: 8 }}
               onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
            <DealCardMenu dealId={deal.id} />
          </div>

          {/* ── FIGHTERS + VS — poster layout ── */}
          <div style={{
            position: 'relative', zIndex: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', padding: '0 4%', gap: 0,
          }}>

            {/* ── LEFT FIGHTER: Creator ── */}
            <div style={{
              position: 'relative', flex: '0 0 36%', height: '82%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* Crown — above name */}
              {creatorWon && (
                <div style={{
                  fontSize: 16, zIndex: 5, lineHeight: 1, marginBottom: -2,
                  filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))',
                }}>{'\u{1F451}'}</div>
              )}
              {/* Fighter Name — ABOVE card */}
              <span style={{
                marginBottom: 4, fontFamily: 'Cinzel,serif', fontSize: 11, fontWeight: 900,
                color: opponentWon ? 'rgba(255,255,255,0.3)' : '#FFB800',
                letterSpacing: 1.5, textTransform: 'uppercase',
                textShadow: opponentWon ? 'none' : '0 0 12px rgba(255,184,0,0.3)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: '100%', textAlign: 'center', zIndex: 3,
              }}>
                {deal.creator?.username || '?'}
              </span>
              {/* Card */}
              <div style={{
                position: 'relative', width: '100%', flex: 1, minHeight: 0,
                filter: opponentWon
                  ? 'grayscale(70%) brightness(0.4) drop-shadow(0 2px 8px rgba(0,0,0,0.7))'
                  : 'drop-shadow(0 4px 16px rgba(0,0,0,0.9))',
                transition: 'filter 0.3s ease',
              }}>
                {creatorCardUrl ? (
                  <img src={creatorCardUrl} alt={deal.creator?.username || 'Creator'}
                    loading="lazy" decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <CardPlaceholder dimmed={!!opponentWon} />
                )}
              </div>
            </div>

            {/* ── VS CENTER — the deal.jpg already has VS ── */}
            <div style={{
              flex: '0 0 28%', height: '90%', zIndex: 3,
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} />

            {/* ── RIGHT FIGHTER: Opponent ── */}
            <div style={{
              position: 'relative', flex: '0 0 36%', height: '82%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* Crown — above name */}
              {opponentWon && (
                <div style={{
                  fontSize: 16, zIndex: 5, lineHeight: 1, marginBottom: -2,
                  filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))',
                }}>{'\u{1F451}'}</div>
              )}
              {/* Fighter Name — ABOVE card */}
              <span style={{
                marginBottom: 4, fontFamily: 'Cinzel,serif', fontSize: 11, fontWeight: 900,
                color: creatorWon ? 'rgba(255,255,255,0.3)' : '#3B82F6',
                letterSpacing: 1.5, textTransform: 'uppercase',
                textShadow: creatorWon ? 'none' : '0 0 12px rgba(59,130,246,0.3)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: '100%', textAlign: 'center', zIndex: 3,
              }}>
                {deal.opponent?.username || '???'}
              </span>
              {/* Card */}
              <div style={{
                position: 'relative', width: '100%', flex: 1, minHeight: 0,
                filter: creatorWon
                  ? 'grayscale(70%) brightness(0.4) drop-shadow(0 2px 8px rgba(0,0,0,0.7))'
                  : 'drop-shadow(0 4px 16px rgba(0,0,0,0.9))',
                transition: 'filter 0.3s ease',
              }}>
                {deal.opponent ? (
                  opponentCardUrl ? (
                    <img src={opponentCardUrl} alt={deal.opponent.username || 'Opponent'}
                      loading="lazy" decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <CardPlaceholder dimmed={!!creatorWon} />
                  )
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(6,6,6,0.5)', borderRadius: 10,
                    border: '1px dashed rgba(255,184,0,0.2)',
                  }}>
                    <span style={{ fontSize: 16, marginBottom: 4, opacity: 0.4 }}>{'\u{2753}'}</span>
                    <span style={{
                      fontSize: 7, fontFamily: 'Cinzel,serif', fontWeight: 800,
                      color: 'rgba(255,255,255,0.35)', letterSpacing: 1,
                      textAlign: 'center', padding: '0 6px', lineHeight: 1.4,
                      textTransform: 'uppercase',
                    }}>
                      {t('status.waitingAccept')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── ACCEPT CHALLENGE stamp — clickable button on open deals ── */}
          {deal.status === 'open' && !deal.opponent && (
            <div style={{
              position: 'absolute', top: '50%', right: '5%',
              transform: 'translateY(-50%) rotate(-6deg)',
              zIndex: 6,
            }}>
              <div style={{
                border: '3px solid rgba(249,115,22,0.7)',
                borderRadius: 10,
                padding: '8px 16px',
                cursor: 'pointer',
                background: 'rgba(249,115,22,0.08)',
                boxShadow: '0 0 16px rgba(249,115,22,0.2), inset 0 0 8px rgba(249,115,22,0.05)',
                animation: 'accept-stamp-pulse 2s ease-in-out infinite',
              }}>
                <span style={{
                  fontFamily: 'Cinzel,serif', fontSize: 11, fontWeight: 900,
                  color: 'rgba(249,115,22,0.85)', letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  display: 'block', lineHeight: 1.3, textAlign: 'center',
                  whiteSpace: 'pre',
                  textShadow: '0 0 8px rgba(249,115,22,0.3)',
                }}>
                  {'ACCEPT\nCHALLENGE'}
                </span>
              </div>
            </div>
          )}

          {/* Disputed red overlay */}
          {isDisputed && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.1)', pointerEvents: 'none', zIndex: 1 }} />
          )}

          {/* ═══ BOTTOM CENTER — Story only (Challenge moved to title area) ═══ */}
          {storyText && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              zIndex: 4, pointerEvents: 'none',
              padding: '0 14px 8px',
              display: 'flex', justifyContent: 'center',
            }}>
              <p style={{
                margin: 0, fontSize: 10, fontFamily: 'var(--font-body)',
                color: 'rgba(255,255,255,0.55)', textAlign: 'center',
                letterSpacing: 0.3,
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
              }}>
                {storyText}
              </p>
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes vs-deadline-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes accept-stamp-pulse {
          0%, 100% { box-shadow: 0 0 16px rgba(249,115,22,0.2), inset 0 0 8px rgba(249,115,22,0.05); }
          50% { box-shadow: 0 0 24px rgba(249,115,22,0.35), inset 0 0 12px rgba(249,115,22,0.1); }
        }
      `}</style>
    </Link>
  )
}
