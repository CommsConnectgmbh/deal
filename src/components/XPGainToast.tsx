'use client'
import React, { useEffect, useState } from 'react'
import CoinIcon from '@/components/CoinIcon'

interface Props {
  xp: number
  coins?: number
  onDone: () => void
}

export default function XPGainToast({ xp, coins, onDone }: Props) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    setTimeout(() => setShow(true), 50)
    const timer = setTimeout(() => { setShow(false); setTimeout(onDone, 300) }, 2500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: show ? 80 : -60,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9990,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 20px',
      borderRadius: 24,
      background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
      boxShadow: '0 4px 20px rgba(255,184,0,0.3)',
      transition: 'top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-inverse)' }}>
        +{xp} XP
      </span>
      {coins && coins > 0 && (
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.6)' }}>
          +{coins} <CoinIcon size={14} />
        </span>
      )}
    </div>
  )
}
