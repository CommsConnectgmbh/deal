'use client'
import { useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import InteractionBar from '@/components/InteractionBar'
import { type DealCardProps } from '@/lib/deal-feed-types'
import { useLang } from '@/contexts/LanguageContext'
import DealCardMenu from '@/components/DealCardMenu'

/* ═══════════════════════════════════════════════════════════════
   InvitedChallengeCard — Titel oben, Media + Lesezeichen, Einsatz mittig
   Orange accent, CTA "Annehmen"
   ═══════════════════════════════════════════════════════════════ */
export default function InvitedChallengeCard({
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
  const creatorName = deal.creator?.display_name || deal.creator?.username || '?'

  return (
    <div data-deal-card={deal.id} style={{ marginBottom: 28, position: 'relative', paddingTop: 10, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>

      {/* ═══ 3-DOT MENU — top right ═══ */}
      <div style={{ position: 'absolute', top: 14, right: 10, zIndex: 8 }}>
        <DealCardMenu dealId={deal.id} onHide={() => onHide?.(deal.id)} />
      </div>

      <div style={{
        borderRadius: 14, overflow: 'hidden',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
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
            <span style={{ color: 'var(--text-muted)' }}>{t('feed.challengesYou')}</span>
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
                color: 'var(--text-primary)', letterSpacing: 1,
                borderRadius: 8, padding: '6px 16px',
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-subtle)',
              }}>
                {'\uD83C\uDFC6'} {deal.stake}
              </span>
            )}
            {deal.deadline && (() => {
              const diff = new Date(deal.deadline).getTime() - Date.now()
              if (diff <= 0) return <span style={{ fontSize: 9, color: 'var(--status-error)', fontWeight: 600 }}>{'\u23F3'} {t('status.expired')}</span>
              const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000)
              const txt = d > 0 ? `${d}d` : h > 0 ? `${h}h` : `${m}min`
              return <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>{'\u23F3'} {txt}</span>
            })()}
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
