'use client'
import { useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import InteractionBar from '@/components/InteractionBar'
import DealChallengeWidget from '@/components/DealChallengeWidget'
import { type DealCardProps } from '@/lib/deal-feed-types'
import { useLang } from '@/contexts/LanguageContext'
import DealCardMenu from '@/components/DealCardMenu'

/* ═══════════════════════════════════════════════════════════════
   LiveDuelCard — Titel oben, Media + Lesezeichen, Einsatz mittig, Tipp Widget
   Green glow for active, purple for pending_confirmation
   ═══════════════════════════════════════════════════════════════ */
export default function LiveDuelCard({
  deal, expanded, onToggleExpand, feedEvents, feedMedia,
  challengeQuotes, onCommentOpen, userId, onHide,
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
  const creatorName = deal.creator?.display_name || deal.creator?.username || '?'
  const opponentName = deal.opponent?.display_name || deal.opponent?.username || '?'

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

        {/* ═══ MEDIA + BEGEGNUNG LESEZEICHEN (top) + EINSATZ LESEZEICHEN (bottom) ═══ */}
        <div onClick={goToDeal} style={{
          position: 'relative', cursor: 'pointer',
          minHeight: deal.media_url ? undefined : 88,
          background: deal.media_url ? undefined : `
            radial-gradient(at 20% 30%, rgba(245,158,11,0.18) 0%, transparent 55%),
            radial-gradient(at 80% 70%, rgba(34,197,94,0.12) 0%, transparent 55%),
            radial-gradient(at 50% 100%, rgba(59,130,246,0.10) 0%, transparent 50%)
          `,
        }}>
          {/* Lesezeichen oben links — Begegnung (Apple liquid glass) */}
          <div style={{
            position: 'absolute', top: 0, left: 12, zIndex: 2,
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(20px) saturate(200%)',
            WebkitBackdropFilter: 'blur(20px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.6)',
            borderTop: 'none',
            padding: '5px 10px', borderRadius: '0 0 12px 12px',
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>{'\u2694\uFE0F'}</span>
            <span>{creatorName}</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: 10, letterSpacing: 1 }}>VS</span>
            <span>{opponentName}</span>
          </div>

          {/* Lesezeichen unten links — Einsatz (mirror of top bookmark) */}
          {(deal.stake || deal.deadline) && (
            <div style={{
              position: 'absolute', bottom: 0, left: 12, zIndex: 2,
              background: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(20px) saturate(200%)',
              WebkitBackdropFilter: 'blur(20px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.6)',
              borderBottom: 'none',
              padding: '5px 10px', borderRadius: '12px 12px 0 0',
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
              boxShadow: '0 -4px 14px rgba(0,0,0,0.08), inset 0 -1px 0 rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {deal.stake && (
                <>
                  <span>{'\uD83C\uDFC6'}</span>
                  <span>{deal.stake}</span>
                </>
              )}
              {deal.deadline && (() => {
                const diff = new Date(deal.deadline).getTime() - Date.now()
                if (diff <= 0) return <span style={{ fontSize: 10, color: 'var(--status-error)', fontWeight: 600, marginLeft: deal.stake ? 6 : 0 }}>{'\u23F3'} {t('status.expired')}</span>
                const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000)
                const txt = d > 0 ? `${d}d` : h > 0 ? `${h}h` : `${m}min`
                return <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginLeft: deal.stake ? 6 : 0 }}>{'\u23F3'} {txt}</span>
              })()}
            </div>
          )}

          {deal.media_url ? (
            deal.media_type === 'video' ? (
              <video ref={videoRef} src={deal.media_url} muted playsInline loop preload="auto"
                style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
            ) : (
              <img src={deal.media_url} alt="" loading="lazy"
                style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
            )
          ) : null}
        </div>

        {/* ═══ Tipp Widget ═══ */}
        <DealChallengeWidget
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

    </div>
  )
}
