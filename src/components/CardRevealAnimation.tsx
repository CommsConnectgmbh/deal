'use client'
import React, { useState, useEffect, useRef } from 'react'
import { RARITY_COLORS, FRAME_COLORS, getCardImageUrl } from '@/lib/card-helpers'
import { useLang } from '@/contexts/LanguageContext'

/* ═══════════════════════════════════════════════════════════════
   CardRevealAnimation — 3D flip reveal for new cards
   Used after avatar creation and card upgrades.
   ═══════════════════════════════════════════════════════════════ */

interface CardRevealProps {
  card: {
    image_url: string | null
    frame: string
    rarity: string
    serial_display?: string | null
    card_code?: string
  }
  onComplete: () => void
}

const PARTICLE_EMOJIS: Record<string, string[]> = {
  common: ['\u2728'],
  rare: ['\u{1F4AB}', '\u2728', '\u{1F947}'],
  epic: ['\u{1F48E}', '\u2728', '\u{1F4AB}'],
  legendary: ['\u26A1', '\u{1F525}', '\u2B50', '\u{1F4AB}', '\u2728'],
  founder: ['\u{1F451}', '\u{1F525}', '\u{1F49B}', '\u26A1', '\u2728', '\u{1F31F}'],
  event: ['\u{1F389}', '\u{1F386}', '\u{1F4AB}', '\u2728', '\u{1F308}'],
}

const RARITY_LABELS: Record<string, string> = {
  common: 'COMMON', rare: 'RARE', epic: 'EPIC',
  legendary: 'LEGENDARY', founder: 'FOUNDER', event: 'EVENT',
}

const STYLE_ID = 'card-reveal-keyframes'
function ensureKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    @keyframes cr-flip {
      0% { transform: perspective(800px) rotateY(180deg) scale(0.8); }
      60% { transform: perspective(800px) rotateY(-10deg) scale(1.05); }
      80% { transform: perspective(800px) rotateY(5deg) scale(1.0); }
      100% { transform: perspective(800px) rotateY(0deg) scale(1.0); }
    }
    @keyframes cr-glow-pulse {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.15); }
    }
    @keyframes cr-particle-rise {
      0% { opacity: 1; transform: translate(0, 0) scale(1); }
      100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.3); }
    }
    @keyframes cr-fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
    @keyframes cr-slide-up { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
    @keyframes cr-shimmer {
      0% { left: -100%; }
      100% { left: 200%; }
    }
    @keyframes cr-light-beam {
      0% { opacity: 0; transform: scaleY(0); }
      30% { opacity: 1; transform: scaleY(1); }
      100% { opacity: 0; transform: scaleY(1.5); }
    }
  `
  document.head.appendChild(s)
}

export default function CardRevealAnimation({ card, onComplete }: CardRevealProps) {
  const { t } = useLang()
  const [phase, setPhase] = useState<'anticipation' | 'flip' | 'display'>('anticipation')
  const [particles, setParticles] = useState<{ id: number; emoji: string; dx: number; dy: number }[]>([])
  const particleIdRef = useRef(0)

  useEffect(() => { ensureKeyframes() }, [])

  // Phase transitions
  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase('flip')
      spawnParticles()
    }, 800)

    const t2 = setTimeout(() => setPhase('display'), 1800)
    const t3 = setTimeout(() => onComplete(), 4500)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const spawnParticles = () => {
    const emojis = PARTICLE_EMOJIS[card.rarity] || PARTICLE_EMOJIS.common
    const count = card.rarity === 'legendary' || card.rarity === 'founder' ? 20 : card.rarity === 'epic' ? 14 : card.rarity === 'rare' ? 8 : 4
    const newParticles = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2
      const dist = 80 + Math.random() * 180
      return {
        id: particleIdRef.current++,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 40,
      }
    })
    setParticles(newParticles)
  }

  const rc = RARITY_COLORS[card.rarity] || RARITY_COLORS.common
  const fc = FRAME_COLORS[card.frame] || '#CD7F32'
  const imgSrc = getCardImageUrl(card)
  const isHighRarity = ['legendary', 'founder', 'event', 'epic'].includes(card.rarity)

  return (
    <div
      onClick={() => onComplete()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        animation: 'cr-fade-in 0.3s ease-out',
        cursor: 'pointer',
      }}
    >
      {/* Light beam for high rarity */}
      {isHighRarity && phase !== 'anticipation' && (
        <div style={{
          position: 'absolute', top: 0, left: '50%', width: 120, height: '100%',
          transform: 'translateX(-50%)',
          background: `linear-gradient(180deg, ${rc}00, ${rc}33, ${rc}00)`,
          animation: 'cr-light-beam 1.5s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}

      {/* Glow halo */}
      {phase !== 'anticipation' && (
        <div style={{
          position: 'absolute',
          width: 300, height: 300, borderRadius: '50%',
          background: `radial-gradient(circle, ${rc}44, transparent 70%)`,
          animation: 'cr-glow-pulse 2s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            fontSize: 20 + Math.random() * 12,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            animation: `cr-particle-rise ${1.2 + Math.random() * 0.8}s ease-out forwards`,
            pointerEvents: 'none',
          } as React.CSSProperties}
        >
          {p.emoji}
        </div>
      ))}

      {/* Card container */}
      <div style={{
        width: 200, height: 290,
        animation: phase === 'flip' || phase === 'display'
          ? 'cr-flip 0.8s cubic-bezier(0.25, 0.8, 0.25, 1) forwards'
          : 'none',
        opacity: phase === 'anticipation' ? 0.4 : 1,
        transition: 'opacity 0.3s',
      }}>
        <div style={{
          width: '100%', height: '100%',
          borderRadius: 14,
          overflow: 'hidden',
          border: `3px solid ${fc}`,
          boxShadow: `0 0 30px ${rc}66, 0 0 60px ${rc}33`,
          position: 'relative',
          background: '#0a0a0a',
        }}>
          {/* Card image */}
          <img
            src={imgSrc}
            alt="New card"
            loading="lazy"
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover', display: 'block',
            }}
          />

          {/* Shimmer overlay */}
          {phase === 'display' && (
            <div style={{
              position: 'absolute', inset: 0, overflow: 'hidden',
              pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: '-100%',
                width: '60%', height: '100%',
                background: `linear-gradient(90deg, transparent, ${rc}25, transparent)`,
                animation: 'cr-shimmer 2s ease-in-out 0.3s 1',
              }} />
            </div>
          )}

          {/* Serial display */}
          {card.serial_display && (
            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 9, color: fc, opacity: 0.8,
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}>
              {card.serial_display}
            </div>
          )}
        </div>
      </div>

      {/* Info text below card */}
      {phase === 'display' && (
        <div style={{
          marginTop: 24, textAlign: 'center',
          animation: 'cr-slide-up 0.5s ease-out',
        }}>
          {/* Rarity badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 16px', borderRadius: 20,
            background: `${rc}22`, border: `1px solid ${rc}55`,
            marginBottom: 12,
          }}>
            <span style={{
              fontFamily: "'Oswald',sans-serif",
              fontSize: 11, fontWeight: 700, letterSpacing: 2,
              color: rc,
            }}>
              {RARITY_LABELS[card.rarity] || card.rarity.toUpperCase()} &middot; {card.frame.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>

          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.5)',
            fontFamily: 'var(--font-display)',
            letterSpacing: 1,
          }}>
            {t('card.tapToContinue')}
          </p>
        </div>
      )}
    </div>
  )
}
