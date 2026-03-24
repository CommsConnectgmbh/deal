'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref])
  return visible
}

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref)
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

export default function RootPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [showLanding, setShowLanding] = useState(false)

  useEffect(() => {
    if (loading) return
    if (user) {
      router.replace('/app/home')
    } else {
      setShowLanding(true)
    }
  }, [user, loading, router])

  if (!showLanding) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#080808' }}>
        <div style={{ width: 40, height: 40, border: '2px solid transparent', borderTopColor: '#FFB800', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ background: '#080808', minHeight: '100dvh', color: '#fff', overflowX: 'hidden' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .landing-wrap { max-width: 430px; margin: 0 auto; padding: 0 20px; }
        .gold-btn {
          display: inline-block;
          background: linear-gradient(135deg, #FFB800 0%, #FF8C00 100%);
          color: #080808;
          font-family: 'Oswald', sans-serif;
          font-weight: 700;
          font-size: 18px;
          text-transform: uppercase;
          letter-spacing: 1px;
          padding: 16px 40px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 20px rgba(255, 184, 0, 0.3);
        }
        .gold-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(255, 184, 0, 0.45); }
        .gold-btn:active { transform: translateY(0); }
        .outline-btn {
          display: inline-block;
          background: transparent;
          color: #FFB800;
          font-family: 'Oswald', sans-serif;
          font-weight: 600;
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 1px;
          padding: 14px 32px;
          border-radius: 12px;
          border: 2px solid #FFB800;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.2s, color 0.2s, transform 0.2s;
        }
        .outline-btn:hover { background: rgba(255, 184, 0, 0.1); transform: translateY(-1px); }
        .feature-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 184, 0, 0.12);
          border-radius: 16px;
          padding: 24px 20px;
          text-align: center;
          transition: border-color 0.3s, transform 0.3s;
        }
        .feature-card:hover { border-color: rgba(255, 184, 0, 0.35); transform: translateY(-4px); }
        .stat-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 184, 0, 0.08);
          border: 1px solid rgba(255, 184, 0, 0.2);
          border-radius: 100px;
          padding: 10px 20px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
        }
        .store-badge {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 14px 20px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          flex: 1;
          justify-content: center;
        }
      `}</style>

      <div className="landing-wrap">
        {/* HERO */}
        <section style={{ textAlign: 'center', paddingTop: '60px', paddingBottom: '48px' }}>
          <FadeIn>
            <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '16px' }}>🤝</div>
            <div style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: '28px',
              fontWeight: 700,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              background: 'linear-gradient(135deg, #FFB800, #FF8C00)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '24px',
            }}>
              DealBuddy
            </div>
          </FadeIn>

          <FadeIn delay={150}>
            <h1 style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: '36px',
              fontWeight: 700,
              lineHeight: 1.15,
              margin: '0 0 16px',
              textTransform: 'uppercase',
            }}>
              Dein Wort.<br />
              <span style={{ color: '#FFB800' }}>Dein Status.</span>
            </h1>
          </FadeIn>

          <FadeIn delay={300}>
            <p style={{
              fontSize: '16px',
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.6,
              margin: '0 0 36px',
              maxWidth: '320px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}>
              Fordere Freunde heraus. Beweise dich. Werde zur Legende.
            </p>
          </FadeIn>

          <FadeIn delay={450}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
              <Link href="/auth/register" className="gold-btn">
                Jetzt starten
              </Link>
              <Link href="/auth/login" className="outline-btn">
                Einloggen
              </Link>
            </div>
          </FadeIn>
        </section>

        {/* FEATURES */}
        <section style={{ paddingBottom: '48px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { emoji: '⚡', title: 'Deal in 10 Sekunden', desc: 'Erstelle eine Challenge, wähle deinen Gegner, setz deinen Einsatz.' },
              { emoji: '📸', title: 'Beweis hochladen', desc: 'Kamera-only Proof. Kein Fake. Kein KI-Bild.' },
              { emoji: '🏆', title: 'Status aufbauen', desc: 'Battle Cards, Streaks, Leaderboard. Zeig wer du bist.' },
            ].map((f, i) => (
              <FadeIn key={i} delay={i * 150}>
                <div className="feature-card">
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>{f.emoji}</div>
                  <h3 style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: '18px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                    color: '#FFB800',
                  }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, margin: 0 }}>
                    {f.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <FadeIn>
          <section style={{ textAlign: 'center', paddingBottom: '48px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="stat-pill">
                <span style={{ fontSize: '18px' }}>🔥</span>
                <span><strong style={{ color: '#FFB800' }}>1.000+</strong> Deals abgeschlossen</span>
              </div>
              <div className="stat-pill">
                <span style={{ fontSize: '18px' }}>⭐</span>
                <span><strong style={{ color: '#FFB800' }}>4.8</strong> Rating</span>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* APP STORE */}
        <FadeIn>
          <section style={{ paddingBottom: '48px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="store-badge">
                <span style={{ fontSize: '20px' }}></span>
                <span>Bald im App Store</span>
              </div>
              <div className="store-badge">
                <span style={{ fontSize: '20px' }}>▶️</span>
                <span>Bald bei Google Play</span>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* FOOTER */}
        <footer style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: '24px',
          paddingBottom: '40px',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[
              { label: 'AGB', href: '/legal/terms' },
              { label: 'Datenschutz', href: '/legal/privacy' },
              { label: 'Impressum', href: '/legal/imprint' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#FFB800')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', margin: 0 }}>
            &copy; 2026 DealBuddy by Comms Connect GmbH
          </p>
        </footer>
      </div>
    </div>
  )
}
