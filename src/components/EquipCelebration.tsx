'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'

/* ═══════════════════════════════════════════════════════════════
   EquipCelebration — Full-screen animated reveal when equipping
   a new frame, archetype, or card.

   Phases:
     1. darkness    → screen goes dark, golden sparks swirl
     2. drop        → card drops from above with motion blur
     3. impact      → card lands with shockwave + flash
     4. showcase    → card glows, particles explode, title appears
     5. buttons     → "AUSRÜSTEN" / "SPÄTER" slide up
   ═══════════════════════════════════════════════════════════════ */

interface EquipCelebrationProps {
  /** Title shown after reveal, e.g. "Gold Rahmen" */
  title: string
  /** Subtitle, e.g. "freigeschaltet!" */
  subtitle?: string
  /** Emoji shown large during impact */
  emoji?: string
  /** Primary color for glow/particles (hex) */
  color?: string
  /** Optional card image URL to show */
  cardImageUrl?: string | null
  /** Called when user taps "Ausrüsten" */
  onEquip: () => void
  /** Called when user taps "Später" */
  onDismiss: () => void
}

const STYLE_ID = 'equip-celebration-kf'
function ensureKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    @keyframes ec-fade-in { 0%{opacity:0} 100%{opacity:1} }
    @keyframes ec-drop {
      0%   { transform: translateY(-120vh) rotate(-8deg) scale(0.6); opacity:0; }
      65%  { transform: translateY(10px) rotate(2deg) scale(1.05); opacity:1; }
      80%  { transform: translateY(-8px) rotate(-1deg) scale(0.98); }
      100% { transform: translateY(0) rotate(0deg) scale(1); }
    }
    @keyframes ec-impact-ring {
      0%   { transform: scale(0); opacity:0.8; }
      60%  { opacity:0.3; }
      100% { transform: scale(3.5); opacity:0; }
    }
    @keyframes ec-impact-flash {
      0%   { opacity:0.6; }
      100% { opacity:0; }
    }
    @keyframes ec-glow-breathe {
      0%,100% { opacity:0.5; transform:scale(1); }
      50%     { opacity:1;   transform:scale(1.15); }
    }
    @keyframes ec-particle-burst {
      0%   { transform: translate(0,0) scale(1); opacity:1; }
      100% { transform: translate(var(--px),var(--py)) scale(0.2); opacity:0; }
    }
    @keyframes ec-spark-float {
      0%   { transform: translate(var(--sx),var(--sy)) scale(0); opacity:0; }
      20%  { opacity:1; transform: translate(var(--sx),var(--sy)) scale(1); }
      100% { transform: translate(var(--ex),var(--ey)) scale(0); opacity:0; }
    }
    @keyframes ec-slide-up {
      0%   { opacity:0; transform:translateY(30px); }
      100% { opacity:1; transform:translateY(0); }
    }
    @keyframes ec-shimmer {
      0%   { left:-120%; }
      100% { left:220%; }
    }
    @keyframes ec-title-pop {
      0%   { opacity:0; transform:scale(0.5) translateY(20px); letter-spacing:8px; }
      60%  { transform:scale(1.1) translateY(-4px); letter-spacing:5px; }
      100% { opacity:1; transform:scale(1) translateY(0); letter-spacing:3px; }
    }
    @keyframes ec-rays {
      0%   { opacity:0; transform:rotate(0deg); }
      30%  { opacity:0.3; }
      100% { opacity:0; transform:rotate(180deg); }
    }
    @keyframes ec-confetti {
      0%   { transform: translate(0,-20px) rotate(0deg); opacity:1; }
      100% { transform: translate(var(--cx),var(--cy)) rotate(var(--cr)); opacity:0; }
    }
  `
  document.head.appendChild(s)
}

export default function EquipCelebration({
  title, subtitle = 'freigeschaltet!', emoji = '💎',
  color = '#F59E0B', cardImageUrl, onEquip, onDismiss,
}: EquipCelebrationProps) {
  const [phase, setPhase] = useState<'darkness' | 'drop' | 'impact' | 'showcase' | 'buttons'>('darkness')
  const sparkIdRef = useRef(0)
  const [sparks, setSparks] = useState<any[]>([])
  const [particles, setParticles] = useState<any[]>([])
  const [confetti, setConfetti] = useState<any[]>([])

  useEffect(() => { ensureKeyframes() }, [])

  // Pre-impact sparks during darkness phase
  useEffect(() => {
    if (phase !== 'darkness') return
    const interval = setInterval(() => {
      const id = sparkIdRef.current++
      setSparks(prev => [...prev.slice(-15), {
        id,
        sx: (Math.random() - 0.5) * 300,
        sy: (Math.random() - 0.5) * 400,
        ex: (Math.random() - 0.5) * 100,
        ey: -50 + Math.random() * 100,
        dur: 0.8 + Math.random() * 0.6,
      }])
    }, 80)
    return () => clearInterval(interval)
  }, [phase])

  // Phase transitions
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('drop'), 600),
      setTimeout(() => { setPhase('impact'); spawnParticles() }, 1200),
      setTimeout(() => { setPhase('showcase'); spawnConfetti() }, 1600),
      setTimeout(() => setPhase('buttons'), 2400),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const spawnParticles = useCallback(() => {
    const ps = Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2 + Math.random() * 0.3
      const dist = 100 + Math.random() * 200
      return {
        id: i,
        emoji: ['✨', '⭐', '💫', '🔥', '💎'][Math.floor(Math.random() * 5)],
        px: Math.cos(angle) * dist,
        py: Math.sin(angle) * dist,
        dur: 0.6 + Math.random() * 0.5,
        delay: Math.random() * 0.15,
        size: 14 + Math.random() * 18,
      }
    })
    setParticles(ps)
  }, [])

  const spawnConfetti = useCallback(() => {
    const cs = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      cx: (Math.random() - 0.5) * 400,
      cy: 200 + Math.random() * 300,
      cr: (Math.random() - 0.5) * 720,
      color: [color, '#fff', '#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA'][Math.floor(Math.random() * 6)],
      size: 4 + Math.random() * 6,
      dur: 1.5 + Math.random() * 1,
      delay: Math.random() * 0.3,
    }))
    setConfetti(cs)
  }, [color])

  const showCard = phase !== 'darkness'
  const showImpact = phase === 'impact' || phase === 'showcase' || phase === 'buttons'
  const showShowcase = phase === 'showcase' || phase === 'buttons'
  const showButtons = phase === 'buttons'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.95)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      animation: 'ec-fade-in 0.3s ease-out',
      overflow: 'hidden',
    }}>
      {/* === Background rays === */}
      {showImpact && (
        <div style={{
          position: 'absolute', inset: '-50%',
          background: `conic-gradient(from 0deg, transparent 0%, ${color}15 5%, transparent 10%, transparent 15%, ${color}10 20%, transparent 25%)`,
          animation: 'ec-rays 4s linear forwards',
          pointerEvents: 'none',
        }} />
      )}

      {/* === Pre-impact golden sparks === */}
      {phase === 'darkness' && sparks.map(sp => (
        <div key={sp.id} style={{
          position: 'absolute', width: 4, height: 4, borderRadius: '50%',
          background: color,
          boxShadow: `0 0 8px ${color}, 0 0 16px ${color}`,
          '--sx': `${sp.sx}px`, '--sy': `${sp.sy}px`,
          '--ex': `${sp.ex}px`, '--ey': `${sp.ey}px`,
          animation: `ec-spark-float ${sp.dur}s ease-out forwards`,
          pointerEvents: 'none',
        } as React.CSSProperties} />
      ))}

      {/* === Glow halo behind card === */}
      {showImpact && (
        <div style={{
          position: 'absolute',
          width: 350, height: 350, borderRadius: '50%',
          background: `radial-gradient(circle, ${color}55, ${color}22, transparent 70%)`,
          animation: 'ec-glow-breathe 2.5s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* === Impact ring === */}
      {phase === 'impact' && (
        <div style={{
          position: 'absolute',
          width: 100, height: 100, borderRadius: '50%',
          border: `3px solid ${color}`,
          animation: 'ec-impact-ring 0.8s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}

      {/* === Impact flash === */}
      {phase === 'impact' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 50% 50%, ${color}44, transparent 60%)`,
          animation: 'ec-impact-flash 0.5s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}

      {/* === Particle burst === */}
      {showImpact && particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', fontSize: p.size,
          '--px': `${p.px}px`, '--py': `${p.py}px`,
          animation: `ec-particle-burst ${p.dur}s ease-out ${p.delay}s forwards`,
          pointerEvents: 'none',
        } as React.CSSProperties}>
          {p.emoji}
        </div>
      ))}

      {/* === Confetti pieces === */}
      {showShowcase && confetti.map(c => (
        <div key={c.id} style={{
          position: 'absolute',
          width: c.size, height: c.size * 1.5,
          borderRadius: 2, background: c.color,
          '--cx': `${c.cx}px`, '--cy': `${c.cy}px`,
          '--cr': `${c.cr}deg`,
          animation: `ec-confetti ${c.dur}s ease-out ${c.delay}s forwards`,
          pointerEvents: 'none',
        } as React.CSSProperties} />
      ))}

      {/* === Card / Emoji drop === */}
      {showCard && (
        <div style={{
          animation: 'ec-drop 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
          position: 'relative',
        }}>
          {cardImageUrl ? (
            <div style={{
              width: 180, height: 270,
              borderRadius: 16, overflow: 'hidden',
              border: `3px solid ${color}`,
              boxShadow: showImpact
                ? `0 0 40px ${color}88, 0 0 80px ${color}44, 0 20px 60px rgba(0,0,0,0.5)`
                : `0 10px 40px rgba(0,0,0,0.5)`,
              transition: 'box-shadow 0.3s ease',
              background: '#0a0a0a',
              position: 'relative',
            }}>
              <img src={cardImageUrl} alt={title} loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {/* Shimmer sweep */}
              {showShowcase && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                  <div style={{
                    position: 'absolute', top: 0, left: '-120%',
                    width: '50%', height: '100%',
                    background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)`,
                    animation: 'ec-shimmer 1.5s ease-in-out 0.2s 1',
                  }} />
                </div>
              )}
            </div>
          ) : (
            <div style={{
              width: 140, height: 140,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${color}33, ${color}11)`,
              border: `3px solid ${color}66`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: showImpact
                ? `0 0 50px ${color}66, 0 0 100px ${color}33`
                : 'none',
              transition: 'box-shadow 0.3s ease',
              fontSize: 64,
            }}>
              {emoji}
            </div>
          )}
        </div>
      )}

      {/* === Title + Subtitle === */}
      {showShowcase && (
        <div style={{
          marginTop: 28, textAlign: 'center',
          animation: 'ec-title-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 24,
            fontWeight: 800, color, letterSpacing: 3,
            textShadow: `0 0 30px ${color}66`,
            margin: 0, lineHeight: 1.2,
          }}>
            {title}
          </h2>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 13,
            color: 'rgba(255,255,255,0.6)', letterSpacing: 2,
            marginTop: 6,
          }}>
            {subtitle}
          </p>
        </div>
      )}

      {/* === Action Buttons === */}
      {showButtons && (
        <div style={{
          marginTop: 32, width: '100%', maxWidth: 300,
          display: 'flex', flexDirection: 'column', gap: 10,
          animation: 'ec-slide-up 0.5s ease-out forwards',
          padding: '0 20px',
        }}>
          <button onClick={onEquip} style={{
            width: '100%', padding: 16, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${color}cc, ${color})`,
            color: '#000', fontFamily: 'var(--font-display)',
            fontSize: 14, fontWeight: 800, letterSpacing: 3,
            boxShadow: `0 4px 20px ${color}55`,
            transition: 'transform 0.1s',
          }}>
            JETZT AUSRÜSTEN
          </button>
          <button onClick={onDismiss} style={{
            width: '100%', padding: 14, borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-display)',
            fontSize: 11, letterSpacing: 2, cursor: 'pointer',
          }}>
            SPÄTER
          </button>
        </div>
      )}
    </div>
  )
}
