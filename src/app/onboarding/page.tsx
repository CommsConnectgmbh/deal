'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Pre-registration landing — feels like a game, not a tool.
 * 2 screens max: Competitive hook → Legal + Register
 */
export default function OnboardingPage() {
  const [screen, setScreen] = useState<'hook' | 'legal'>('hook')
  const [age, setAge] = useState(false)
  const [terms, setTerms] = useState(false)
  const [animate, setAnimate] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setTimeout(() => setAnimate(true), 100)
  }, [])

  const goRegister = () => {
    if (!age || !terms) return
    localStorage.setItem('onboarding_complete', 'true')
    router.replace('/auth/register')
  }

  if (screen === 'legal') {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #060606, #0A0A0A)',
        display: 'flex', flexDirection: 'column',
        maxWidth: 430, margin: '0 auto',
      }}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 28px 0', textAlign: 'center',
        }}>
          <span style={{ fontSize: 48, marginBottom: 20 }}>⚠️</span>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 22,
            color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 8,
          }}>
            Fast geschafft
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32 }}>
            Bestätige kurz die Teilnahmebedingungen.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 340 }}>
            {[
              { val: age, set: setAge, label: 'Ich bin mindestens 18 Jahre alt.' },
              { val: terms, set: setTerms, label: 'Ich akzeptiere die Nutzungsbedingungen und Datenschutzrichtlinie.' },
            ].map(({ val, set, label }, i) => (
              <button key={i} onClick={() => set(!val)} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 2,
                  border: `1.5px solid ${val ? 'var(--gold-primary)' : 'var(--border-subtle)'}`,
                  background: val ? 'var(--gold-dim)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {val && <span style={{ color: 'var(--text-inverse)', fontSize: 14, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '24px 28px 48px' }}>
          <button
            onClick={goRegister}
            disabled={!age || !terms}
            style={{
              width: '100%', padding: 18, borderRadius: 14, border: 'none',
              cursor: !age || !terms ? 'not-allowed' : 'pointer',
              background: !age || !terms
                ? 'rgba(255,255,255,0.06)'
                : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))',
              color: !age || !terms ? 'var(--text-muted)' : 'var(--text-inverse)',
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: 3,
              boxShadow: age && terms ? '0 4px 24px rgba(245,158,11,0.3)' : 'none',
            }}
          >
            ACCOUNT ERSTELLEN
          </button>
          <button
            onClick={() => setScreen('hook')}
            style={{
              width: '100%', marginTop: 14, background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13,
            }}
          >
            ← Zurück
          </button>
        </div>
      </div>
    )
  }

  // ── Screen 1: The Hook ──
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#060606',
      display: 'flex', flexDirection: 'column',
      maxWidth: 430, margin: '0 auto', position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow effects */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,184,0,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,184,0,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 28px 0', textAlign: 'center',
        position: 'relative', zIndex: 1,
      }}>
        {/* Animated trophy */}
        <div style={{
          fontSize: 72, marginBottom: 32, lineHeight: 1,
          opacity: animate ? 1 : 0,
          transform: animate ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.8)',
          transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          filter: 'drop-shadow(0 0 20px rgba(255,184,0,0.3))',
        }}>
          ⚔️
        </div>

        {/* Main headline */}
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900,
          color: '#F0ECE4', lineHeight: 1.2, marginBottom: 16,
          letterSpacing: 2, textTransform: 'uppercase',
          opacity: animate ? 1 : 0,
          transform: animate ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          COMPETE WITH<br/>
          <span style={{ color: 'var(--gold-primary)' }}>YOUR FRIENDS</span>
        </h1>

        {/* Sub-headline */}
        <p style={{
          fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.8,
          maxWidth: 280, fontFamily: 'var(--font-body)',
          opacity: animate ? 1 : 0,
          transform: animate ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          Starte Challenges. Gewinne Duelle.<br/>
          Klettere im Leaderboard.
        </p>

        {/* Three icons row */}
        <div style={{
          display: 'flex', gap: 24, marginTop: 40,
          opacity: animate ? 1 : 0,
          transform: animate ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          {[
            { icon: '🏆', label: 'COMPETE' },
            { icon: '🔥', label: 'WIN' },
            { icon: '👑', label: 'REIGN' },
          ].map((item) => (
            <div key={item.label} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'rgba(255,184,0,0.06)',
                border: '1px solid rgba(255,184,0,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>
                {item.icon}
              </div>
              <span style={{
                fontSize: 8, fontFamily: 'var(--font-display)', letterSpacing: 2,
                color: 'var(--text-muted)', fontWeight: 700,
              }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        padding: '24px 28px 48px', position: 'relative', zIndex: 1,
        opacity: animate ? 1 : 0,
        transform: animate ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.6s 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <button
          onClick={() => setScreen('legal')}
          style={{
            width: '100%', padding: 20, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))',
            color: 'var(--text-inverse)', fontFamily: 'var(--font-display)',
            fontSize: 15, fontWeight: 900, letterSpacing: 4,
            boxShadow: '0 4px 32px rgba(245,158,11,0.35), 0 0 60px rgba(245,158,11,0.1)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <span style={{ position: 'relative', zIndex: 1 }}>START COMPETING</span>
          <div style={{
            position: 'absolute', top: 0, left: '-100%', width: '200%', height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
            animation: 'btn-shimmer 2.5s infinite',
          }} />
        </button>

        <button
          onClick={() => {
            localStorage.setItem('onboarding_complete', 'true')
            router.replace('/auth/login')
          }}
          style={{
            width: '100%', marginTop: 16, background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14,
            fontFamily: 'var(--font-body)',
          }}
        >
          Schon einen Account? <span style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>Einloggen</span>
        </button>
      </div>

      <style>{`
        @keyframes btn-shimmer {
          0% { transform: translateX(-30%); }
          100% { transform: translateX(30%); }
        }
      `}</style>
    </div>
  )
}
