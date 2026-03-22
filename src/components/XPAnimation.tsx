'use client'
import { useEffect, useState } from 'react'
import CoinIcon from '@/components/CoinIcon'

interface Props {
  xp: number
  coins?: number
  onDone: () => void
}

export default function XPAnimation({ xp, coins, onDone }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 400)
    const t2 = setTimeout(() => setPhase('exit'), 1600)
    const t3 = setTimeout(onDone, 2000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  const opacity = phase === 'enter' ? 0 : phase === 'hold' ? 1 : 0
  const translateY = phase === 'enter' ? 60 : phase === 'hold' ? 0 : -40

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9995,
      pointerEvents: 'none',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        opacity,
        transform: `translateY(${translateY}px) scale(${phase === 'hold' ? 1 : 0.7})`,
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 36,
          fontWeight: 900,
          color: 'var(--gold-primary)',
          textShadow: '0 0 30px rgba(255,184,0,0.6), 0 0 60px rgba(255,184,0,0.2)',
          letterSpacing: 2,
        }}>
          +{xp} XP
        </span>
        {coins && coins > 0 && (
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            textShadow: '0 0 20px rgba(255,184,0,0.3)',
          }}>
            +{coins} <CoinIcon size={14} />
          </span>
        )}
      </div>
    </div>
  )
}
