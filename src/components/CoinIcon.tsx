import React from 'react'

interface CoinIconProps {
  size?: number
  style?: React.CSSProperties
}

export default function CoinIcon({ size = 18, style }: CoinIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        verticalAlign: 'middle',
        display: 'inline-block',
        flexShrink: 0,
        ...style,
      }}
    >
      <circle cx="12" cy="12" r="11" fill="url(#dbCoinGrad)" stroke="#B45309" strokeWidth="1" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#92400E" strokeWidth="0.5" opacity="0.4" />
      <text x="12" y="16.5" textAnchor="middle" fill="#7C2D12" fontSize="12" fontWeight="800" fontFamily="Oswald, sans-serif">D</text>
      <defs>
        <linearGradient id="dbCoinGrad" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
    </svg>
  )
}
