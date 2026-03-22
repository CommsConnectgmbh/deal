'use client'
import { BADGE_CONFIG, type BadgeType } from '@/lib/deal-feed-types'
import { useLang } from '@/contexts/LanguageContext'

interface Props {
  badge: BadgeType
  pulse?: boolean
  size?: 'sm' | 'md'
}

export default function DealBadge({ badge, pulse, size = 'sm' }: Props) {
  const { t } = useLang()
  const cfg = BADGE_CONFIG[badge]
  const fontSize = size === 'md' ? 8 : 7
  const pad = size === 'md' ? '3px 9px' : '3px 7px'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize, padding: pad, borderRadius: 5, flexShrink: 0,
      fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 1,
      color: cfg.color,
      border: `1px solid ${cfg.color}33`,
      background: `${cfg.color}10`,
    }}>
      {/* Pulse dot for live / invited badges */}
      {pulse && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: cfg.color,
          boxShadow: `0 0 6px ${cfg.glow}`,
          animation: 'badge-pulse 1.5s ease-in-out infinite',
          flexShrink: 0,
        }} />
      )}
      {t(cfg.labelKey)}
      <style>{`
        @keyframes badge-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </span>
  )
}
