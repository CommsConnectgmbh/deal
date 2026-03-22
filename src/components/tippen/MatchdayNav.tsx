'use client'
import { useRef, useEffect } from 'react'

interface Props {
  totalMatchdays: number
  currentMatchday: number
  activeMatchday: number
  onSelect: (md: number) => void
}

/**
 * Horizontal numbered matchday bar: ← [1] [2] [**3●**] [4] ... →
 * Auto-scrolls to active matchday on mount.
 */
export default function MatchdayNav({ totalMatchdays, currentMatchday, activeMatchday, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollRef.current) return
    const active = scrollRef.current.querySelector(`[data-md="${activeMatchday}"]`) as HTMLElement
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeMatchday])

  if (totalMatchdays <= 0) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '10px 0', borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-base)',
    }}>
      {/* Left arrow */}
      <button
        onClick={() => onSelect(Math.max(1, activeMatchday - 1))}
        disabled={activeMatchday <= 1}
        style={{
          background: 'none', border: 'none', cursor: activeMatchday > 1 ? 'pointer' : 'default',
          color: activeMatchday > 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
          fontSize: 18, padding: '4px 8px', lineHeight: 1, flexShrink: 0,
        }}
      >
        ‹
      </button>

      {/* Scrollable matchday chips */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, display: 'flex', gap: 6, overflowX: 'auto',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {Array.from({ length: totalMatchdays }, (_, i) => i + 1).map(md => {
          const isActive = md === activeMatchday
          const isCurrent = md === currentMatchday
          return (
            <button
              key={md}
              data-md={md}
              onClick={() => onSelect(md)}
              style={{
                minWidth: 36, height: 36, borderRadius: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                background: isActive
                  ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))'
                  : 'var(--bg-elevated)',
                border: isCurrent && !isActive ? '1px solid var(--gold-glow)' : '1px solid transparent',
                color: isActive ? 'var(--text-inverse)' : isCurrent ? 'var(--gold-primary)' : 'var(--text-secondary)',
                fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700,
                cursor: 'pointer', position: 'relative', letterSpacing: 0.5,
              }}
            >
              {md}
              {isCurrent && (
                <span style={{
                  position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%',
                  background: isActive ? '#fff' : 'var(--gold-primary)',
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Right arrow */}
      <button
        onClick={() => onSelect(Math.min(totalMatchdays, activeMatchday + 1))}
        disabled={activeMatchday >= totalMatchdays}
        style={{
          background: 'none', border: 'none',
          cursor: activeMatchday < totalMatchdays ? 'pointer' : 'default',
          color: activeMatchday < totalMatchdays ? 'var(--text-secondary)' : 'var(--text-muted)',
          fontSize: 18, padding: '4px 8px', lineHeight: 1, flexShrink: 0,
        }}
      >
        ›
      </button>
    </div>
  )
}
