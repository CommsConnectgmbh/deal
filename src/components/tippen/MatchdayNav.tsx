'use client'
import { useRef, useEffect } from 'react'

export interface KoChip {
  key: string
  label: string
  isCurrent?: boolean
}

interface Props {
  totalMatchdays: number
  currentMatchday: number
  activeMatchday: number
  onSelect: (md: number) => void
  koStages?: KoChip[]
  activeKoStage?: string | null
  onSelectKo?: (key: string) => void
}

/**
 * Horizontal numbered matchday bar: ← [1] [2] [**3●**] [4] [1/8] [1/4] ... →
 * Numeric matchday chips first, then KO-stage chips (Sechzehntel/Achtel/…).
 * Selecting a matchday clears the active KO stage; selecting a KO chip
 * clears the active matchday so the parent can filter by stage instead.
 * Auto-scrolls to the active chip on mount.
 */
export default function MatchdayNav({
  totalMatchdays,
  currentMatchday,
  activeMatchday,
  onSelect,
  koStages = [],
  activeKoStage = null,
  onSelectKo,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollRef.current) return
    const selector = activeKoStage
      ? `[data-ko="${activeKoStage}"]`
      : `[data-md="${activeMatchday}"]`
    const active = scrollRef.current.querySelector(selector) as HTMLElement | null
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeMatchday, activeKoStage])

  if (totalMatchdays <= 0 && koStages.length === 0) return null

  // Build a flat list of "steps" so the < > arrows can walk matchdays AND KO chips.
  type Step = { kind: 'md'; md: number } | { kind: 'ko'; key: string }
  const steps: Step[] = [
    ...Array.from({ length: totalMatchdays }, (_, i): Step => ({ kind: 'md', md: i + 1 })),
    ...koStages.map((s): Step => ({ kind: 'ko', key: s.key })),
  ]
  const activeIdx = activeKoStage
    ? steps.findIndex(s => s.kind === 'ko' && s.key === activeKoStage)
    : steps.findIndex(s => s.kind === 'md' && s.md === activeMatchday)
  const go = (idx: number) => {
    const step = steps[idx]
    if (!step) return
    if (step.kind === 'md') onSelect(step.md)
    else if (onSelectKo) onSelectKo(step.key)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '10px 0', borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-base)',
    }}>
      {/* Left arrow */}
      <button
        onClick={() => go(Math.max(0, activeIdx - 1))}
        disabled={activeIdx <= 0}
        style={{
          background: 'none', border: 'none', cursor: activeIdx > 0 ? 'pointer' : 'default',
          color: activeIdx > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
          fontSize: 18, padding: '4px 8px', lineHeight: 1, flexShrink: 0,
        }}
      >
        ‹
      </button>

      {/* Scrollable matchday + KO chips */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, display: 'flex', gap: 6, overflowX: 'auto',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {Array.from({ length: totalMatchdays }, (_, i) => i + 1).map(md => {
          const isActive = !activeKoStage && md === activeMatchday
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

        {/* Divider between numbered matchdays and KO stages */}
        {totalMatchdays > 0 && koStages.length > 0 && (
          <span style={{
            flexShrink: 0, width: 1, alignSelf: 'stretch',
            margin: '4px 4px', background: 'var(--border-subtle)',
          }} />
        )}

        {koStages.map(ko => {
          const isActive = activeKoStage === ko.key
          return (
            <button
              key={ko.key}
              data-ko={ko.key}
              onClick={() => onSelectKo && onSelectKo(ko.key)}
              style={{
                minWidth: 44, height: 36, padding: '0 10px', borderRadius: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                background: isActive
                  ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))'
                  : 'var(--bg-elevated)',
                border: ko.isCurrent && !isActive ? '1px solid var(--gold-glow)' : '1px solid transparent',
                color: isActive ? 'var(--text-inverse)' : ko.isCurrent ? 'var(--gold-primary)' : 'var(--text-secondary)',
                fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700,
                cursor: 'pointer', position: 'relative', letterSpacing: 0.5,
              }}
            >
              {ko.label}
              {ko.isCurrent && (
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
        onClick={() => go(Math.min(steps.length - 1, activeIdx + 1))}
        disabled={activeIdx >= steps.length - 1}
        style={{
          background: 'none', border: 'none',
          cursor: activeIdx < steps.length - 1 ? 'pointer' : 'default',
          color: activeIdx < steps.length - 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
          fontSize: 18, padding: '4px 8px', lineHeight: 1, flexShrink: 0,
        }}
      >
        ›
      </button>
    </div>
  )
}
