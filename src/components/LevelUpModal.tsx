'use client'
import React, { useEffect, useState } from 'react'
import { useLang } from '@/contexts/LanguageContext'

interface Props {
  level: number
  onClose: () => void
}

export default function LevelUpModal({ level, onClose }: Props) {
  const { t } = useLang()
  const [visible, setVisible] = useState(false)
  const [particles, setParticles] = useState<{ id: number; x: number; delay: number; size: number; color: string }[]>([])

  useEffect(() => {
    // Generate confetti particles
    const p = Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.8,
      size: 4 + Math.random() * 6,
      color: ['var(--gold-primary)', 'var(--gold-dim)', 'var(--gold-bright)', '#F59E0B', '#FCD34D'][Math.floor(Math.random() * 5)],
    }))
    setParticles(p)
    setTimeout(() => setVisible(true), 50)
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s',
      }}
    >
      {/* Gold burst ring */}
      <div style={{
        position: 'absolute',
        width: 300, height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,184,0,0.15) 0%, rgba(255,184,0,0.05) 40%, transparent 70%)',
        animation: 'burstPulse 2s ease-in-out infinite',
      }} />

      {/* Confetti particles */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          top: '-5%',
          left: `${p.x}%`,
          width: p.size,
          height: p.size,
          background: p.color,
          borderRadius: p.size > 6 ? 2 : '50%',
          animation: `confettiFall 2.5s ${p.delay}s ease-in forwards`,
          opacity: 0,
        }} />
      ))}

      {/* Level number */}
      <div style={{
        fontSize: 72,
        fontFamily: 'var(--font-display)',
        fontWeight: 900,
        color: 'var(--gold-primary)',
        textShadow: '0 0 40px rgba(255,184,0,0.5), 0 0 80px rgba(255,184,0,0.2)',
        animation: visible ? 'scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' : 'none',
        transform: 'scale(0)',
        lineHeight: 1,
        marginBottom: 12,
      }}>
        {level}
      </div>

      {/* Text */}
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: 16,
        letterSpacing: 4,
        color: 'var(--gold-primary)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.5s 0.3s ease',
      }}>
        {t('components.levelReached')}
      </p>

      <p style={{
        fontSize: 12,
        color: 'var(--text-muted)',
        marginTop: 24,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s 1s',
      }}>
        {t('components.tapToClose')}
      </p>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes scaleIn {
          0% { transform: scale(0) rotate(-10deg); }
          60% { transform: scale(1.1) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes burstPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
