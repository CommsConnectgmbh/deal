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
    <div data-deal-card={deal.id} style={{ marginBottom: 20, position: 'relative' }}>

      {/* ═══ 3-DOT MENU — top right ═══ */}
      <div style={{ position: 'absolute', top: 14, right: 10, zIndex: 8 }}>
        <DealCardMenu dealId={deal.id} onHide={() => onHide?.(deal.id)} />
      </div>

      <div style={{
        borderRadius: 18, overflow: 'hidden',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--shadow-md)',
      }}>

        {/* ═══ TITLE BAR — calm, primary text ═══ */}
        <div style={{
          width: '100%', padding: '10px 16px', textAlign: 'center',
        }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
            color: 'var(--text-primary)', letterSpacing: 1.5, textTransform: 'uppercase',
            margin: 0, lineHeight: 1.3,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as never,
          }}>
            {deal.title}
          </p>
        </div>

        {/* ═══ MEDIA + BEGEGNUNG LESEZEICHEN ═══ */}
        <div onClick={goToDeal} style={{ position: 'relative', cursor: 'pointer' }}>
          {/* Lesezeichen oben links */}
          <div style={{
            position: 'absolute', top: 0, left: 12, zIndex: 2,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px) saturate(180%)',
            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
            border: '1px solid var(--glass-border)',
            borderTop: 'none',
            padding: '5px 10px', borderRadius: '0 0 8px 8px',
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span>{'\u2694\uFE0F'}</span>
            <span>{creatorName}</span>
            {opponentName && (
              <><span style={{ color: 'var(--text-muted)' }}>vs</span> <span>{opponentName}</span></>
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
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-subtle)',
              }}>
                {'\uD83C\uDFC6'} {deal.stake}
              </span>
            )}
            {winnerId && winner && (
              <span style={{ fontSize: 10, color: 'var(--status-active)', fontWeight: 600 }}>
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

    </div>
  )
}
