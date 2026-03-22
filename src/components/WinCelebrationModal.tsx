'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'

/* ═══════════════════════════════════════════════════════════════
   WinCelebrationModal — Full-screen celebration after winning a deal.
   Replaces simple XP toast with immersive reward experience.

   Phases:
     1. overlay     → black overlay fades in, gold burst ring pulses
     2. crown       → 👑 scales in with bounce + "DEAL GEWONNEN!"
     3. names       → winner name slides up, loser name faded
     4. rewards     → XP / Coins / Streak cards slide in from bottom
     5. frame       → optional frame progress bar fills animated
     6. confetti    → 30 gold/orange particles fall continuously
     7. close       → "WEITER" button after 2s, tap anywhere to close
   ═══════════════════════════════════════════════════════════════ */

interface WinCelebrationProps {
  xp: number
  coins: number
  streak: number
  winnerName: string
  loserName: string
  dealTitle: string
  frameProgress?: { frameName: string; current: number; target: number; frameEmoji: string } | null
  onClose: () => void
}

const STYLE_ID = 'win-celebration-kf'

function ensureKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    @keyframes wc-fade-in {
      0% { opacity: 0 }
      100% { opacity: 1 }
    }
    @keyframes wc-burst-ring {
      0% { transform: scale(0.2); opacity: 0.8; border-width: 6px }
      50% { transform: scale(1.2); opacity: 0.4; border-width: 2px }
      100% { transform: scale(1.8); opacity: 0; border-width: 1px }
    }
    @keyframes wc-crown-bounce {
      0% { transform: scale(0); opacity: 0 }
      50% { transform: scale(1.3) }
      70% { transform: scale(0.9) }
      100% { transform: scale(1); opacity: 1 }
    }
    @keyframes wc-text-reveal {
      0% { transform: translateY(20px); opacity: 0 }
      100% { transform: translateY(0); opacity: 1 }
    }
    @keyframes wc-slide-up {
      0% { transform: translateY(60px); opacity: 0 }
      100% { transform: translateY(0); opacity: 1 }
    }
    @keyframes wc-card-enter {
      0% { transform: translateY(80px) scale(0.8); opacity: 0 }
      60% { transform: translateY(-5px) scale(1.02) }
      100% { transform: translateY(0) scale(1); opacity: 1 }
    }
    @keyframes wc-glow-pulse {
      0%, 100% { box-shadow: 0 0 8px rgba(255,184,0,0.3), 0 0 20px rgba(255,184,0,0.1) }
      50% { box-shadow: 0 0 16px rgba(255,184,0,0.5), 0 0 40px rgba(255,184,0,0.2) }
    }
    @keyframes wc-progress-fill {
      0% { width: var(--wc-progress-from) }
      100% { width: var(--wc-progress-to) }
    }
    @keyframes wc-confetti-fall {
      0% { transform: translateY(-10vh) rotate(0deg); opacity: 1 }
      80% { opacity: 1 }
      100% { transform: translateY(110vh) rotate(720deg); opacity: 0 }
    }
    @keyframes wc-shimmer {
      0% { background-position: -200% center }
      100% { background-position: 200% center }
    }
    @keyframes wc-bar-glow {
      0%, 100% { filter: brightness(1) }
      50% { filter: brightness(1.3) }
    }
  `
  document.head.appendChild(s)
}

export default function WinCelebrationModal({
  xp,
  coins,
  streak,
  winnerName,
  loserName,
  dealTitle,
  frameProgress,
  onClose,
}: WinCelebrationProps) {
  const [phase, setPhase] = useState(0)
  const [showButton, setShowButton] = useState(false)
  const [confetti, setConfetti] = useState<
    { id: number; x: number; delay: number; duration: number; size: number; color: string; rotation: number }[]
  >([])
  const closedRef = useRef(false)

  const handleClose = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    onClose()
  }, [onClose])

  useEffect(() => {
    ensureKeyframes()

    // Generate confetti particles
    const particles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2.5 + Math.random() * 2,
      size: 4 + Math.random() * 6,
      color: [
        'var(--gold-primary, #FFB800)',
        'var(--gold-dim, #B8860B)',
        'var(--gold-bright, #FFD700)',
        '#F59E0B',
        '#FCD34D',
        '#E8890C',
        '#FF9500',
      ][Math.floor(Math.random() * 7)],
      rotation: Math.random() * 360,
    }))
    setConfetti(particles)

    // Phase timings
    const t1 = setTimeout(() => setPhase(1), 50)
    const t2 = setTimeout(() => setPhase(2), 500)
    const t3 = setTimeout(() => setPhase(3), 1000)
    const t4 = setTimeout(() => setPhase(4), 1500)
    const t5 = setTimeout(() => setPhase(5), 2500)
    const tBtn = setTimeout(() => setShowButton(true), 2000)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
      clearTimeout(tBtn)
    }
  }, [])

  const progressFrom = frameProgress
    ? `${Math.max(0, ((frameProgress.current - 1) / frameProgress.target) * 100)}%`
    : '0%'
  const progressTo = frameProgress
    ? `${Math.min(100, (frameProgress.current / frameProgress.target) * 100)}%`
    : '0%'

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        opacity: phase >= 1 ? 1 : 0,
        transition: 'opacity 0.4s ease-out',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
        overflow: 'hidden',
      }}
    >
      {/* ── Confetti Particles ── */}
      {confetti.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: 0,
            width: p.size,
            height: p.size,
            borderRadius: p.size > 7 ? '2px' : '50%',
            background: p.color,
            opacity: 0,
            animation: `wc-confetti-fall ${p.duration}s ${p.delay}s ease-in infinite`,
            pointerEvents: 'none',
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}

      {/* ── Gold Burst Ring ── */}
      {phase >= 1 && (
        <div
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: '50%',
            border: '4px solid var(--gold-primary, #FFB800)',
            animation: 'wc-burst-ring 1s ease-out forwards',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── Crown + Title ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          marginBottom: 24,
        }}
      >
        {/* Crown emoji */}
        <div
          style={{
            fontSize: 72,
            lineHeight: 1,
            opacity: phase >= 2 ? 1 : 0,
            animation: phase >= 2 ? 'wc-crown-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
            filter: 'drop-shadow(0 0 20px rgba(255,184,0,0.5))',
          }}
        >
          👑
        </div>

        {/* DEAL GEWONNEN! */}
        <div
          style={{
            fontFamily: 'var(--font-display, Cinzel, serif)',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 3,
            color: 'var(--gold-primary, #FFB800)',
            textShadow: '0 0 20px rgba(255,184,0,0.4), 0 2px 4px rgba(0,0,0,0.5)',
            opacity: phase >= 2 ? 1 : 0,
            animation: phase >= 2 ? 'wc-text-reveal 0.5s 0.2s ease-out both' : 'none',
            textTransform: 'uppercase',
          }}
        >
          Deal Gewonnen!
        </div>

        {/* Deal title */}
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-muted, #888)',
            opacity: phase >= 2 ? 1 : 0,
            animation: phase >= 2 ? 'wc-text-reveal 0.5s 0.35s ease-out both' : 'none',
            maxWidth: 260,
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {dealTitle}
        </div>
      </div>

      {/* ── Winner vs Loser Names ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          marginBottom: 32,
          opacity: phase >= 3 ? 1 : 0,
          animation: phase >= 3 ? 'wc-slide-up 0.5s ease-out both' : 'none',
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            fontFamily: 'var(--font-display, Cinzel, serif)',
            color: 'var(--gold-bright, #FFD700)',
            textShadow: '0 0 12px rgba(255,184,0,0.3)',
          }}
        >
          {winnerName}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted, #666)',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          vs
        </div>
        <div
          style={{
            fontSize: 15,
            color: 'var(--text-muted, #555)',
            opacity: 0.5,
            textDecoration: 'line-through',
            textDecorationColor: 'rgba(255,255,255,0.15)',
          }}
        >
          {loserName}
        </div>
      </div>

      {/* ── Reward Cards ── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: 28,
          opacity: phase >= 4 ? 1 : 0,
        }}
      >
        {/* XP Card */}
        <div
          style={{
            minWidth: 80,
            padding: '14px 16px',
            background: 'var(--bg-surface, #1a1a1a)',
            border: '1px solid var(--gold-primary, #FFB800)',
            borderRadius: 'var(--radius-md, 12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            animation: phase >= 4 ? 'wc-card-enter 0.6s ease-out both, wc-glow-pulse 2s 1s ease-in-out infinite' : 'none',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: 1 }}>
            XP
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              fontFamily: 'var(--font-display, Cinzel, serif)',
              color: 'var(--gold-primary, #FFB800)',
              textShadow: '0 0 10px rgba(255,184,0,0.4)',
            }}
          >
            +{xp}
          </div>
        </div>

        {/* Coins Card */}
        <div
          style={{
            minWidth: 80,
            padding: '14px 16px',
            background: 'var(--bg-surface, #1a1a1a)',
            border: '1px solid var(--gold-primary, #FFB800)',
            borderRadius: 'var(--radius-md, 12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            animation: phase >= 4 ? 'wc-card-enter 0.6s 0.1s ease-out both, wc-glow-pulse 2s 1.1s ease-in-out infinite' : 'none',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Coins
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              fontFamily: 'var(--font-display, Cinzel, serif)',
              color: 'var(--gold-primary, #FFB800)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              textShadow: '0 0 10px rgba(255,184,0,0.4)',
            }}
          >
            <span style={{ fontSize: 18 }}>🪙</span>
            +{coins}
          </div>
        </div>

        {/* Streak Card (only if > 1) */}
        {streak > 1 && (
          <div
            style={{
              minWidth: 80,
              padding: '14px 16px',
              background: 'var(--bg-surface, #1a1a1a)',
              border: '1px solid var(--gold-primary, #FFB800)',
              borderRadius: 'var(--radius-md, 12px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              animation: phase >= 4 ? 'wc-card-enter 0.6s 0.2s ease-out both, wc-glow-pulse 2s 1.2s ease-in-out infinite' : 'none',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Streak
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                fontFamily: 'var(--font-display, Cinzel, serif)',
                color: 'var(--gold-primary, #FFB800)',
                textShadow: '0 0 10px rgba(255,184,0,0.4)',
              }}
            >
              🔥 {streak}er
            </div>
          </div>
        )}
      </div>

      {/* ── Frame Progress Bar ── */}
      {frameProgress && (
        <div
          style={{
            width: '85%',
            maxWidth: 320,
            marginBottom: 32,
            opacity: phase >= 5 ? 1 : 0,
            animation: phase >= 5 ? 'wc-slide-up 0.5s ease-out both' : 'none',
          }}
        >
          {/* Frame name + emoji */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary, #eee)',
              }}
            >
              <span>{frameProgress.frameEmoji}</span>
              <span>{frameProgress.frameName}</span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted, #888)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {frameProgress.current}/{frameProgress.target}
            </div>
          </div>

          {/* Progress bar track */}
          <div
            style={{
              width: '100%',
              height: 10,
              borderRadius: 'var(--radius-lg, 16px)',
              background: 'var(--bg-deepest, #0d0d0d)',
              border: '1px solid var(--border-subtle, #333)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Animated fill */}
            <div
              style={{
                height: '100%',
                borderRadius: 'var(--radius-lg, 16px)',
                background: 'linear-gradient(90deg, var(--gold-dim, #B8860B), var(--gold-primary, #FFB800), var(--gold-bright, #FFD700))',
                backgroundSize: '200% 100%',
                // @ts-ignore CSS custom properties for keyframe
                '--wc-progress-from': progressFrom,
                '--wc-progress-to': progressTo,
                animation: phase >= 5
                  ? 'wc-progress-fill 1s 0.3s ease-out both, wc-shimmer 2s 1.3s linear infinite, wc-bar-glow 2s 1.3s ease-in-out infinite'
                  : 'none',
                boxShadow: '0 0 8px rgba(255,184,0,0.4), 0 0 20px rgba(255,184,0,0.15)',
              } as React.CSSProperties}
            />
          </div>
        </div>
      )}

      {/* ── WEITER Button ── */}
      {showButton && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleClose()
          }}
          style={{
            marginTop: 8,
            padding: '12px 48px',
            background: 'transparent',
            border: '1.5px solid var(--gold-primary, #FFB800)',
            borderRadius: 'var(--radius-md, 12px)',
            color: 'var(--gold-primary, #FFB800)',
            fontFamily: 'var(--font-display, Cinzel, serif)',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: 'uppercase',
            cursor: 'pointer',
            animation: 'wc-slide-up 0.4s ease-out both, wc-glow-pulse 2.5s 0.5s ease-in-out infinite',
            transition: 'background 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--gold-primary, #FFB800)'
            e.currentTarget.style.color = 'var(--text-inverse, #000)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--gold-primary, #FFB800)'
          }}
        >
          Weiter
        </button>
      )}
    </div>
  )
}
