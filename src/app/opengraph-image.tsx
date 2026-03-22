import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'DealBuddy – Compete. Win. Reign.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #060606 0%, #0a0a0a 50%, #060606 100%)',
          fontFamily: 'Georgia, serif',
          position: 'relative',
        }}
      >
        {/* Gold accent glow */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            left: 200,
            width: 800,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,184,0,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Side accent lines */}
        <div style={{ position: 'absolute', left: 80, top: 100, width: 3, height: 430, background: 'linear-gradient(180deg, #FFB800, #FF8C00)', borderRadius: 2, opacity: 0.4 }} />
        <div style={{ position: 'absolute', right: 80, top: 100, width: 3, height: 430, background: 'linear-gradient(180deg, #FFB800, #FF8C00)', borderRadius: 2, opacity: 0.4 }} />

        {/* Logo */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 700,
            color: '#FFB800',
            letterSpacing: 6,
            marginBottom: 16,
          }}
        >
          DealBuddy
        </div>

        {/* Tagline */}
        <div style={{ fontSize: 30, color: '#9CA3AF', letterSpacing: 4, marginBottom: 30 }}>
          CHALLENGE YOUR FRIENDS
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 30 }}>
          <div style={{ width: 120, height: 1, background: 'rgba(255,184,0,0.3)' }} />
          <div style={{ width: 8, height: 8, borderRadius: 4, background: '#FFB800', opacity: 0.5 }} />
          <div style={{ width: 120, height: 1, background: 'rgba(255,184,0,0.3)' }} />
        </div>

        {/* Features */}
        <div style={{ fontSize: 22, color: '#6B7280', letterSpacing: 2 }}>
          Deals erstellen · Coins verdienen · Karten sammeln
        </div>

        {/* CTA Badge */}
        <div
          style={{
            marginTop: 30,
            padding: '14px 48px',
            borderRadius: 26,
            border: '1.5px solid rgba(255,184,0,0.5)',
            fontSize: 18,
            color: '#FFB800',
            letterSpacing: 3,
            fontWeight: 700,
          }}
        >
          JETZT STARTEN
        </div>

        {/* Bottom URL */}
        <div style={{ position: 'absolute', bottom: 40, fontSize: 16, color: '#4B5563', letterSpacing: 2, fontFamily: 'monospace' }}>
          app.deal-buddy.app
        </div>
      </div>
    ),
    { ...size }
  )
}
