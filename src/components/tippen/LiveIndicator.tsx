'use client'

/** Pulsing green dot + LIVE label */
export default function LiveIndicator({ size = 8 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: size, height: size, borderRadius: '50%',
        background: '#22C55E',
        boxShadow: '0 0 6px rgba(34,197,94,0.6)',
        animation: 'livePulse 1.5s ease-in-out infinite',
      }} />
      <span style={{
        fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700,
        color: '#22C55E', letterSpacing: 1.5, textTransform: 'uppercase',
      }}>
        LIVE
      </span>
      <style>{`@keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}`}</style>
    </span>
  )
}
