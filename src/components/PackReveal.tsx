'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useLang } from '@/contexts/LanguageContext'

/* ── Types ──────────────────────────────────────────────────── */

interface RevealCard {
  template_id: string
  name: string
  description: string
  rarity: string       // common | rare | epic | legendary | founder | event
  frame_type: string   // bronze | silver | gold | emerald | sapphire | ruby | ...
  image_url: string | null
  is_new: boolean
  dust_earned: number
  serial_number?: string | null
}

interface PackRevealProps {
  cards: RevealCard[]
  packType: string
  onClose: () => void
  onEquip?: (templateId: string) => void
}

/* ── Config ─────────────────────────────────────────────────── */

const FRAME_COLORS: Record<string, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#F59E0B',
  emerald: '#22C55E', sapphire: '#3B82F6', ruby: '#EF4444',
  amethyst: '#8B5CF6', topaz: '#F97316', legend: '#FBBF24',
  icon: '#A78BFA', obsidian: '#6B7280', founder: '#F59E0B',
  hero: '#60A5FA', futties: '#EC4899', neon: '#34D399',
  celestial: '#E0E7FF', player_of_the_week: '#FBBF24',
}
const RARITY_COLORS: Record<string, string> = {
  common: '#9CA3AF', rare: '#3B82F6', epic: '#8B5CF6',
  legendary: '#F59E0B', founder: '#F59E0B', event: '#EC4899',
}
const RARITY_LABELS: Record<string, string> = {
  common: 'COMMON', rare: 'RARE', epic: 'EPIC',
  legendary: 'LEGENDARY', founder: 'FOUNDER', event: 'EVENT',
}
const RARITY_ICONS: Record<string, string> = {
  common: '\u{1F0CF}', rare: '\u{1F947}', epic: '\u{1F48E}',
  legendary: '\u2B50', founder: '\u{1F451}', event: '\u{1F389}',
}
const PACK_ICONS: Record<string, string> = {
  starter: '\u{1F381}', daily: '\u{1F4E6}', premium: '\u{1F48E}',
  event: '\u{1F3EA}', founder: '\u{1F451}',
}
const RARITY_WEIGHT: Record<string, number> = {
  common: 0, rare: 1, epic: 2, legendary: 3, event: 4, founder: 5,
}
const HIGH_RARITY = new Set(['legendary', 'founder', 'event'])
const EPIC_PLUS = new Set(['epic', 'legendary', 'founder', 'event'])

const PARTICLE_EMOJIS: Record<string, string[]> = {
  epic: ['\u{1F48E}', '\u2728', '\u{1F4AB}'],
  legendary: ['\u26A1', '\u{1F525}', '\u2B50', '\u{1F4AB}', '\u2728'],
  founder: ['\u{1F451}', '\u{1F525}', '\u{1F49B}', '\u26A1', '\u2728', '\u{1F31F}'],
  event: ['\u{1F389}', '\u{1F386}', '\u{1F4AB}', '\u2728', '\u{1F308}'],
}

type Phase = 'anticipation' | 'reveal' | 'summary'

/* ── Component ──────────────────────────────────────────────── */

export default function PackReveal({ cards, packType, onClose, onEquip }: PackRevealProps) {
  const { t } = useLang()
  const [phase, setPhase] = useState<Phase>('anticipation')
  const [revealIndex, setRevealIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [particles, setParticles] = useState<{ id: number; emoji: string; x: number; y: number }[]>([])
  const [shaking, setShaking] = useState(false)
  const [lightBeam, setLightBeam] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const particleIdRef = useRef(0)

  /* ── Phase transitions ─────────────────────────────────────── */

  useEffect(() => {
    if (phase === 'anticipation') {
      timerRef.current = setTimeout(() => {
        setPhase('reveal')
        setRevealIndex(0)
        setFlipped(false)
      }, 1500)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase])

  useEffect(() => {
    if (phase !== 'reveal') return
    setFlipped(false)
    setLightBeam(false)

    const flipTimer = setTimeout(() => {
      setFlipped(true)
      const currentCard = cards[revealIndex]
      if (currentCard) triggerEffects(currentCard.rarity)
    }, 300)

    const advanceTimer = setTimeout(() => { advanceReveal() }, 2500)

    return () => { clearTimeout(flipTimer); clearTimeout(advanceTimer) }
  }, [phase, revealIndex])

  const advanceReveal = useCallback(() => {
    if (revealIndex < cards.length - 1) {
      setRevealIndex(prev => prev + 1)
    } else {
      setPhase('summary')
    }
  }, [revealIndex, cards.length])

  const handleRevealTap = useCallback(() => {
    if (phase === 'reveal') {
      if (!flipped) {
        setFlipped(true)
        const currentCard = cards[revealIndex]
        if (currentCard) triggerEffects(currentCard.rarity)
      } else {
        advanceReveal()
      }
    }
  }, [phase, flipped, revealIndex, advanceReveal, cards])

  /* ── Effects ───────────────────────────────────────────────── */

  const triggerEffects = (rarity: string) => {
    // Screen shake for legendary+
    if (HIGH_RARITY.has(rarity)) {
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
    }
    // Light beam for founder
    if (rarity === 'founder') {
      setLightBeam(true)
      setTimeout(() => setLightBeam(false), 1500)
    }
    // Particles for epic+
    const emojis = PARTICLE_EMOJIS[rarity]
    if (emojis) {
      const count = rarity === 'founder' ? 20 : rarity === 'legendary' ? 16 : 12
      const newParticles = Array.from({ length: count }, (_, i) => ({
        id: particleIdRef.current++,
        emoji: emojis[i % emojis.length],
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 70,
      }))
      setParticles(newParticles)
      setTimeout(() => setParticles([]), 1500)
    }
  }

  /* ── Derived ───────────────────────────────────────────────── */

  const totalDust = cards.reduce((sum, c) => sum + c.dust_earned, 0)
  const newCount = cards.filter(c => c.is_new).length
  const highestCard = cards.reduce((best, c) =>
    (RARITY_WEIGHT[c.rarity] || 0) > (RARITY_WEIGHT[best.rarity] || 0) ? c : best
  , cards[0])
  const packIcon = PACK_ICONS[packType] || '\u{1F4E6}'
  const currentCard = phase === 'reveal' ? cards[revealIndex] : null

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div
      onClick={phase === 'reveal' ? handleRevealTap : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        animation: 'prFadeIn 0.3s ease',
        transform: shaking ? `translate(${Math.random() * 6 - 3}px, ${Math.random() * 6 - 3}px)` : 'none',
        transition: shaking ? 'none' : 'transform 0.1s',
        overflow: 'hidden',
      }}
    >
      {/* ── Inline keyframes ─────────────────────────────────── */}
      <style>{`
        @keyframes prFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes packShake {
          0%, 100% { transform: translate(0, 0) rotate(0deg) }
          10% { transform: translate(-3px, -2px) rotate(-1deg) }
          20% { transform: translate(3px, 2px) rotate(1deg) }
          30% { transform: translate(-4px, 1px) rotate(-2deg) }
          40% { transform: translate(4px, -1px) rotate(2deg) }
          50% { transform: translate(-2px, 3px) rotate(-1deg) }
          60% { transform: translate(3px, -3px) rotate(1deg) }
          70% { transform: translate(-3px, 2px) rotate(-2deg) }
          80% { transform: translate(2px, -2px) rotate(2deg) }
          90% { transform: translate(-1px, 1px) rotate(-1deg) }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 40px var(--gold-primary), 0 0 80px rgba(255,184,0,0.3) }
          50% { box-shadow: 0 0 60px var(--gold-primary), 0 0 120px rgba(255,184,0,0.5) }
        }
        @keyframes cardFlipIn {
          from { transform: perspective(800px) rotateY(180deg); opacity: 0 }
          to { transform: perspective(800px) rotateY(0deg); opacity: 1 }
        }
        @keyframes cardFlipBack {
          from { transform: perspective(800px) rotateY(0deg); opacity: 1 }
          to { transform: perspective(800px) rotateY(180deg); opacity: 0 }
        }
        @keyframes particleFly {
          0% { opacity: 1; transform: translate(0, 0) scale(1) }
          100% { opacity: 0; transform: translate(var(--px), var(--py)) scale(0.3) }
        }
        @keyframes shimmerBorder {
          0% { background-position: -200% 0 }
          100% { background-position: 200% 0 }
        }
        @keyframes rarityGlow {
          0%, 100% { box-shadow: 0 0 20px var(--glow-color), 0 0 40px var(--glow-color-dim) }
          50% { box-shadow: 0 0 40px var(--glow-color), 0 0 80px var(--glow-color-dim) }
        }
        @keyframes newBadgePop {
          0% { transform: scale(0) rotate(-20deg) }
          60% { transform: scale(1.2) rotate(5deg) }
          100% { transform: scale(1) rotate(0deg) }
        }
        @keyframes summarySlideIn {
          from { transform: translateY(40px); opacity: 0 }
          to { transform: translateY(0); opacity: 1 }
        }
        @keyframes lightBeamDown {
          0% { opacity: 0; transform: scaleY(0) }
          30% { opacity: 1; transform: scaleY(1) }
          100% { opacity: 0; transform: scaleY(1) }
        }
        @keyframes rainbowBorder {
          0% { filter: hue-rotate(0deg) }
          100% { filter: hue-rotate(360deg) }
        }
        @keyframes serialReveal {
          from { opacity: 0; transform: translateY(4px) }
          to { opacity: 1; transform: translateY(0) }
        }
      `}</style>

      {/* ── Particles layer ──────────────────────────────────── */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
          fontSize: 24, pointerEvents: 'none',
          '--px': `${(Math.random() - 0.5) * 250}px`,
          '--py': `${(Math.random() - 0.5) * 250}px`,
          animation: 'particleFly 1.2s ease-out forwards', zIndex: 10,
        } as React.CSSProperties}>{p.emoji}</div>
      ))}

      {/* ── Light beam (founder) ─────────────────────────────── */}
      {lightBeam && (
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: '100%',
          background: 'linear-gradient(180deg, rgba(245,158,11,0.6) 0%, rgba(245,158,11,0) 60%)',
          animation: 'lightBeamDown 1.5s ease-out forwards',
          transformOrigin: 'top', pointerEvents: 'none', zIndex: 5,
        }} />
      )}

      {/* ═══════════════ ANTICIPATION PHASE ════════════════════ */}
      {phase === 'anticipation' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <div style={{
            position: 'absolute', width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,184,0,0.2) 0%, transparent 70%)',
            animation: 'glowPulse 1s ease infinite', pointerEvents: 'none',
          }} />
          <div style={{
            fontSize: 80, animation: 'packShake 0.4s ease infinite',
            filter: 'drop-shadow(0 0 20px rgba(255,184,0,0.4))', zIndex: 2,
          }}>{packIcon}</div>
          <div className="font-display" style={{
            fontSize: 14, fontWeight: 800, color: 'var(--text-muted)',
            letterSpacing: 3, textTransform: 'uppercase', zIndex: 2,
          }}>PACK WIRD GEOFFNET...</div>
        </div>
      )}

      {/* ═══════════════ REVEAL PHASE ═════════════════════════ */}
      {phase === 'reveal' && currentCard && (() => {
        const frameColor = FRAME_COLORS[currentCard.frame_type] || RARITY_COLORS[currentCard.rarity] || '#9CA3AF'
        const rarityColor = RARITY_COLORS[currentCard.rarity] || '#9CA3AF'
        const isEpicPlus = EPIC_PLUS.has(currentCard.rarity)
        const isHighRarity = HIGH_RARITY.has(currentCard.rarity)
        const isEvent = currentCard.rarity === 'event'

        return (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            width: '100%', maxWidth: 320, padding: '0 20px',
          }}>
            {/* Card counter */}
            <div style={{
              fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
              marginBottom: 20, letterSpacing: 1,
            }}>{revealIndex + 1} / {cards.length}</div>

            {/* Card container */}
            <div style={{
              width: 220, height: 330, perspective: 800,
              position: 'relative', marginBottom: 24,
            }}>
              {/* Card back */}
              <div style={{
                position: 'absolute', inset: 0,
                backfaceVisibility: 'hidden',
                animation: flipped ? 'cardFlipBack 0.5s ease forwards' : undefined,
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                borderRadius: 16, border: '2px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 8,
              }}>
                <div style={{ fontSize: 48, opacity: 0.4 }}>?</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 700, letterSpacing: 2 }}>DEALBUDDY</div>
              </div>

              {/* Card front */}
              <div style={{
                position: 'absolute', inset: 0,
                backfaceVisibility: 'hidden',
                animation: flipped ? 'cardFlipIn 0.5s ease forwards' : undefined,
                opacity: flipped ? undefined : 0,
                background: '#0a0a0a',
                borderRadius: 16,
                border: `3px solid ${frameColor}`,
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: isHighRarity
                  ? `0 0 40px ${frameColor}55, 0 0 80px ${frameColor}22`
                  : `0 0 16px ${frameColor}33`,
                ...(isEvent ? { animation: flipped ? 'cardFlipIn 0.5s ease forwards, rainbowBorder 3s linear infinite' : 'rainbowBorder 3s linear infinite' } : {}),
              }}>
                {/* Card image area */}
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `radial-gradient(ellipse at 50% 40%, ${frameColor}22, #0a0a0a 70%)`,
                  position: 'relative',
                }}>
                  {currentCard.image_url ? (
                    <img src={currentCard.image_url} alt={currentCard.name} loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ fontSize: 64, opacity: 0.6 }}>
                      {RARITY_ICONS[currentCard.rarity] || '\u{1F0CF}'}
                    </div>
                  )}

                  {/* Frame type label */}
                  <div style={{
                    position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center',
                  }}>
                    <span style={{
                      fontFamily: "'Oswald',sans-serif", fontSize: 10, fontWeight: 700,
                      letterSpacing: '2px', textTransform: 'uppercase',
                      color: frameColor, textShadow: `0 0 8px ${frameColor}66`,
                    }}>{currentCard.frame_type.replace(/_/g, ' ')}</span>
                  </div>

                  {/* Shimmer overlay for common */}
                  {currentCard.rarity === 'common' && (
                    <div style={{
                      position: 'absolute', inset: -3, borderRadius: 16, zIndex: -1,
                      background: `linear-gradient(90deg, transparent, ${frameColor}44, transparent)`,
                      backgroundSize: '200% 100%', animation: 'shimmerBorder 2.5s linear infinite',
                    }} />
                  )}
                </div>

                {/* Card info bar */}
                <div style={{
                  padding: '12px 14px', textAlign: 'center',
                  background: `linear-gradient(0deg, ${frameColor}15, transparent)`,
                  borderTop: `1px solid ${frameColor}33`,
                }}>
                  <div className="font-display" style={{
                    fontSize: 15, fontWeight: 800, color: '#fff',
                    lineHeight: 1.2, marginBottom: 4,
                  }}>{currentCard.name}</div>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: rarityColor,
                    letterSpacing: 2, textTransform: 'uppercase',
                  }}>{RARITY_LABELS[currentCard.rarity] || currentCard.rarity}</div>
                  {/* Serial number */}
                  {currentCard.serial_number && flipped && (
                    <div style={{
                      marginTop: 4, fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 9, color: frameColor, opacity: 0.8,
                      animation: 'serialReveal 0.3s ease 0.6s both',
                    }}>{currentCard.serial_number}</div>
                  )}
                </div>
              </div>

              {/* NEW / DUPLICATE badge */}
              {flipped && (
                <div style={{
                  position: 'absolute', top: -12, right: -12, zIndex: 5,
                  animation: 'newBadgePop 0.4s ease 0.5s both',
                }}>
                  {currentCard.is_new ? (
                    <div style={{
                      background: '#22C55E', color: '#000',
                      fontWeight: 900, fontSize: 11, padding: '4px 10px',
                      borderRadius: 8, letterSpacing: 1,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}>NEU!</div>
                  ) : (
                    <div style={{
                      background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)',
                      fontWeight: 700, fontSize: 10, padding: '4px 10px',
                      borderRadius: 8, letterSpacing: 0.5,
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}>DUPLIKAT &rarr; +{currentCard.dust_earned} Dust</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
              {t('components.tapToContinue')}
            </div>
          </div>
        )
      })()}

      {/* ═══════════════ SUMMARY PHASE ════════════════════════ */}
      {phase === 'summary' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          width: '100%', maxWidth: 380, padding: '0 16px',
          animation: 'summarySlideIn 0.4s ease',
        }}>
          <div className="font-display" style={{
            fontSize: 20, fontWeight: 800, color: 'var(--gold-primary)',
            letterSpacing: 2, marginBottom: 6,
          }}>PACK GEOFFNET!</div>

          <div style={{
            display: 'flex', gap: 16, marginBottom: 20,
            fontSize: 12, color: 'var(--text-secondary)',
          }}>
            <span style={{ fontWeight: 700 }}>{newCount} Neu</span>
            <span style={{ color: 'var(--text-muted)' }}>&middot;</span>
            <span style={{ fontWeight: 700 }}>{cards.length - newCount} Duplikate</span>
            <span style={{ color: 'var(--text-muted)' }}>&middot;</span>
            <span style={{ fontWeight: 700 }}>+{totalDust} &#10024; Dust</span>
          </div>

          {/* Horizontal card scroll */}
          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto', width: '100%',
            paddingBottom: 16, scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}>
            {cards.map((c, i) => {
              const fColor = FRAME_COLORS[c.frame_type] || RARITY_COLORS[c.rarity] || '#9CA3AF'
              return (
                <div key={i} style={{ flexShrink: 0, width: 90, textAlign: 'center' }}>
                  <div style={{
                    width: 90, height: 135, borderRadius: 10,
                    background: '#0a0a0a',
                    border: `2px solid ${fColor}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 6, boxShadow: `0 0 10px ${fColor}22`,
                    overflow: 'hidden', position: 'relative',
                  }}>
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>
                          {RARITY_ICONS[c.rarity] || '\u{1F0CF}'}
                        </div>
                        <div style={{
                          fontSize: 7, fontWeight: 800, color: fColor,
                          letterSpacing: 1, textTransform: 'uppercase',
                        }}>{c.frame_type.replace(/_/g, ' ')}</div>
                      </>
                    )}
                  </div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{c.name}</div>
                  {c.serial_number && (
                    <div style={{ fontSize: 7, color: fColor, fontFamily: "'JetBrains Mono',monospace", marginTop: 1 }}>
                      {c.serial_number}
                    </div>
                  )}
                  {c.is_new && <div style={{ fontSize: 8, color: '#22C55E', fontWeight: 800, marginTop: 2 }}>NEU</div>}
                  {!c.is_new && c.dust_earned > 0 && (
                    <div style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>+{c.dust_earned} &#10024;</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 8 }}>
            {highestCard && onEquip && (
              <button
                onClick={(e) => { e.stopPropagation(); onEquip(highestCard.template_id) }}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                  background: 'var(--gold-primary)', color: '#000',
                  fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: 0.5,
                }}
              >AUSRÜSTEN: {highestCard.name}</button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose() }}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)',
                fontWeight: 800, fontSize: 14, cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: 0.5,
              }}
            >NOCHMAL OFFNEN</button>
            <button
              onClick={(e) => { e.stopPropagation(); onClose() }}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                background: 'transparent', color: 'var(--text-muted)',
                fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >SCHLIESSEN</button>
          </div>
        </div>
      )}
    </div>
  )
}
