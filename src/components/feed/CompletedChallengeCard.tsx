'use client'
import { useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import InteractionBar from '@/components/InteractionBar'
import { type DealCardProps } from '@/lib/deal-feed-types'
import { useLang } from '@/contexts/LanguageContext'
import DealCardMenu from '@/components/DealCardMenu'

/* ═══════════════════════════════════════════════════════════════
   CompletedChallengeCard — Titel oben, Media + Lesezeichen, Einsatz mittig
   Blue/muted accent for completed, red for disputed
   ═══════════════════════════════════════════════════════════════ */
export default function CompletedChallengeCard({
  deal, expanded, onToggleExpand, feedEvents, feedMedia,
  betQuotes, onCommentOpen, userId, onHide,
}: DealCardProps) {
  const router = useRouter()
  const { t } = useLang()
  const isDisputed = deal.status === 'disputed'
  const isMine = deal.creator_id === userId || deal.opponent_id === userId
  const sc = isDisputed ? '#ef4444' : '#9ca3af'
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { video.play().catch(() => {}) } else { video.pause() }
      },
      { threshold: 0.5 }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [deal.media_url])

  const goToDeal = () => router.push(`/app/deals/${deal.id}`)

  // Winner info
  const winnerId = deal.confirmed_winner_id || deal.winner_id
  const isCreatorWinner = winnerId === deal.creator_id
  const winner = isCreatorWinner ? deal.creator : deal.opponent
  const creatorName = deal.creator?.display_name || deal.creator?.username || '?'
  const opponentName = deal.opponent?.display_name || deal.opponent?.username || null

  return (
    <div data-deal-card={deal.id} style={{ marginBottom: 28, position: 'relative', paddingTop: 10, paddingBottom: 20, borderBottom: '1px solid rgba(255,184,0,0.12)' }}>

      {/* ═══ 3-DOT MENU — top right ═══ */}
      <div style={{ position: 'absolute', top: 14, right: 10, zIndex: 8 }}>
        <DealCardMenu dealId={deal.id} onHide={() => onHide?.(deal.id)} />
      </div>

      {/* ═══ BADGE — gleicher Style wie CTA, links oben ═══ */}
      <div style={{
        position: 'absolute', top: -4, left: 16, zIndex: 5,
        padding: '4px 10px 5px',
        background: `linear-gradient(135deg, ${sc}E8, ${sc}D0)`,
        color: '#060606', fontFamily: 'var(--font-display)',
        fontSize: 7, fontWeight: 800, letterSpacing: 1.5,
        borderRadius: '6px 6px 0 0',
        boxShadow: `0 -3px 10px ${sc}40`,
        lineHeight: 1,
      }}>
        {isDisputed ? t('status.disputed') : t('status.completed')}
      </div>

      <div style={{
        borderRadius: 14, overflow: 'hidden',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}>

        {/* ═══ TITLE BAR — farbiger Rahmen oben, max 2 Zeilen ═══ */}
        <div style={{
          width: '100%', padding: '10px 16px', textAlign: 'center',
          background: `linear-gradient(135deg, ${sc}12, ${sc}06)`,
        }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
            color: sc, letterSpacing: 1.5, textTransform: 'uppercase',
            margin: 0, lineHeight: 1.3,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as never,
            textShadow: `0 0 12px ${sc}25`,
          }}>
            {deal.title}
          </p>
        </div>

        {/* ═══ MEDIA + BEGEGNUNG LESEZEICHEN ═══ */}
        <div onClick={goToDeal} style={{ position: 'relative', cursor: 'pointer' }}>
          {/* Lesezeichen oben links */}
          <div style={{
            position: 'absolute', top: 0, left: 12, zIndex: 2,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
            padding: '5px 10px', borderRadius: '0 0 8px 8px',
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span>{'\u2694\uFE0F'}</span>
            <span>{creatorName}</span>
            {opponentName && (
              <><span style={{ color: 'rgba(255,255,255,0.5)' }}>vs</span> <span>{opponentName}</span></>
            )}
          </div>
          {deal.media_url ? (
            deal.media_type === 'video' ? (
              <video ref={videoRef} src={deal.media_url} muted playsInline loop preload="auto"
                style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
            ) : (
              <img src={deal.media_url} alt="" loading="lazy"
                style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
            )
          ) : (
            <div style={{ height: 28 }} />
          )}
        </div>

        {/* ═══ EINSATZ + WINNER — mittig, gerahmt ═══ */}
        {(deal.stake || winnerId) && (
          <div onClick={goToDeal} style={{
            cursor: 'pointer', padding: '8px 12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            {deal.stake && (
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
                color: 'var(--text-primary)', letterSpacing: 1,
                borderRadius: 8, padding: '6px 16px',
                background: 'rgba(255,255,255,0.06)',
                textShadow: 'none',
              }}>
                {'\uD83C\uDFC6'} {deal.stake}
              </span>
            )}
            {winnerId && winner && (
              <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>
                {'\u{1F451}'} {winner.display_name || winner.username}
              </span>
            )}
            {deal.status === 'cancelled' && (
              <span style={{ fontSize: 10, color: '#f87171', fontWeight: 600 }}>{t('status.cancelled')}</span>
            )}
          </div>
        )}

        {/* ═══ Interaction bar mit Badge mittig ═══ */}
        <InteractionBar
          dealId={deal.id}
          dealTitle={deal.title}
          dealStatus={deal.status}
          onCommentOpen={() => onCommentOpen(deal.id)}
        />
      </div>

      {/* ═══ REVANCHE CTA ═══ */}
      {isMine && !isDisputed && (
        <button onClick={(e) => { e.stopPropagation(); router.push(`/app/deals/create?rematch=${deal.id}`) }}
          style={{
            position: 'absolute', bottom: 6, right: 16, zIndex: 5,
            padding: '5px 10px 4px',
            background: 'linear-gradient(135deg, rgba(249,115,22,0.95), rgba(251,146,60,0.9))',
            color: '#060606', fontFamily: 'var(--font-display)',
            fontSize: 7, fontWeight: 800, letterSpacing: 1.5,
            border: 'none', cursor: 'pointer',
            borderRadius: '0 0 6px 6px',
            boxShadow: '0 3px 10px rgba(249,115,22,0.25)', lineHeight: 1,
          }}>
          {'\u2694\uFE0F'} {t('deals.revanche')}
        </button>
      )}
    </div>
  )
}
