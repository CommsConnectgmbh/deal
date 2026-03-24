'use client'
import { useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import InteractionBar from '@/components/InteractionBar'
import DealBetWidget from '@/components/DealBetWidget'
import { type DealCardProps } from '@/lib/deal-feed-types'
import { useLang } from '@/contexts/LanguageContext'
import DealCardMenu from '@/components/DealCardMenu'

/* ═══════════════════════════════════════════════════════════════
   LiveDuelCard — Titel oben, Media + Lesezeichen, Einsatz mittig, Tipp Widget
   Green glow for active, purple for pending_confirmation
   ═══════════════════════════════════════════════════════════════ */
export default function LiveDuelCard({
  deal, expanded, onToggleExpand, feedEvents, feedMedia,
  betQuotes, onCommentOpen, userId, onHide,
}: DealCardProps) {
  const router = useRouter()
  const { t } = useLang()
  const isMine = deal.creator_id === userId || deal.opponent_id === userId
  const sc = deal.status === 'pending_confirmation' ? '#a78bfa' : '#4ade80'
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

  const ctaText = deal.status === 'pending_confirmation'
    ? `\uD83C\uDFC1 ${t('feed.confirm')}`
    : `\uD83C\uDFC1 ${t('feed.result')}`
  const goToDeal = () => router.push(`/app/deals/${deal.id}`)
  const creatorName = deal.creator?.display_name || deal.creator?.username || '?'
  const opponentName = deal.opponent?.display_name || deal.opponent?.username || '?'

  return (
    <div data-deal-card={deal.id} style={{ marginBottom: 32, position: 'relative', paddingTop: 10, paddingBottom: 16, borderBottom: '1px solid rgba(255,184,0,0.12)' }}>

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
        {deal.status === 'pending_confirmation' ? t('status.confirmation') : t('status.live')}
      </div>

      <div style={{
        borderRadius: 14, overflow: 'hidden',
        background: '#111',
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
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>vs</span>
            <span>{opponentName}</span>
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

        {/* ═══ EINSATZ — mittig, gerahmt, gleiche Größe wie Titel ═══ */}
        {(deal.stake || deal.deadline) && (
          <div onClick={goToDeal} style={{
            cursor: 'pointer', padding: '8px 12px',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
          }}>
            {deal.stake && (
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
                color: '#ffffff', letterSpacing: 1,
                borderRadius: 8, padding: '6px 16px',
                background: 'rgba(255,255,255,0.06)',
                textShadow: '0 0 12px rgba(147,197,253,0.15)',
              }}>
                {'\uD83C\uDFC6'} {deal.stake}
              </span>
            )}
            {deal.deadline && (() => {
              const diff = new Date(deal.deadline).getTime() - Date.now()
              if (diff <= 0) return <span style={{ fontSize: 9, color: '#EF4444', fontWeight: 600 }}>{'\u23F3'} {t('status.expired')}</span>
              const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000)
              const txt = d > 0 ? `${d}d` : h > 0 ? `${h}h` : `${m}min`
              return <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>{'\u23F3'} {txt}</span>
            })()}
          </div>
        )}

        {/* ═══ Tipp Widget ═══ */}
        <DealBetWidget
          dealId={deal.id}
          creatorId={deal.creator_id}
          opponentId={deal.opponent_id || undefined}
          creatorName={deal.creator?.username || '?'}
          opponentName={deal.opponent?.username || '?'}
          dealStatus={deal.status}
          winnerId={deal.winner_id || deal.confirmed_winner_id || undefined}
          creatorAvatarUrl={deal.creator?.avatar_url}
          opponentAvatarUrl={deal.opponent?.avatar_url}
        />

        {/* ═══ Interaction bar mit Badge mittig ═══ */}
        <InteractionBar
          dealId={deal.id}
          dealTitle={deal.title}
          dealStatus={deal.status}
          onCommentOpen={() => onCommentOpen(deal.id)}
        />
      </div>

      {/* ═══ CTA ═══ */}
      {isMine && (
        <button onClick={(e) => { e.stopPropagation(); goToDeal() }}
          style={{
            position: 'absolute', bottom: -14, right: 16, zIndex: 5,
            padding: '5px 10px 4px',
            background: 'linear-gradient(135deg, rgba(40,160,80,0.95), rgba(74,222,128,0.9))',
            color: '#060606', fontFamily: 'var(--font-display)',
            fontSize: 7, fontWeight: 800, letterSpacing: 1.5,
            border: 'none', cursor: 'pointer',
            borderRadius: '0 0 6px 6px',
            boxShadow: '0 3px 10px rgba(74,222,128,0.25)', lineHeight: 1,
          }}>
          {ctaText}
        </button>
      )}
    </div>
  )
}
