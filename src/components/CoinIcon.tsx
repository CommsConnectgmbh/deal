import React from 'react'

interface CoinIconProps {
  size?: number
  style?: React.CSSProperties
}

export default function CoinIcon({ size = 18, style }: CoinIconProps) {
  return (
    <img
      src="/coin.png"
      alt="coin"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        verticalAlign: 'middle',
        display: 'inline-block',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
