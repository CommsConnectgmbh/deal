'use client'
import React from 'react'

/**
 * Simple circular avatar component with starter-image fallback.
 * Used everywhere in the app: chat, comments, profiles, nav bar, etc.
 */
interface UserAvatarProps {
  size?: number
  avatarUrl?: string | null
  name?: string
  /** Gold border for special highlights */
  goldBorder?: boolean
  /** Show online indicator */
  online?: boolean
  /** onClick handler */
  onClick?: () => void
}

export default function UserAvatar({
  size = 40,
  avatarUrl,
  name,
  goldBorder = false,
  online = false,
  onClick,
}: UserAvatarProps) {
  const src = avatarUrl || '/avatar-male.jpg'
  const borderWidth = goldBorder ? 2 : 0

  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: '#1A1A1A',
        flexShrink: 0,
        border: goldBorder ? `${borderWidth}px solid rgba(255,184,0,0.4)` : 'none',
        cursor: onClick ? 'pointer' : undefined,
        position: 'relative',
      }}
    >
      <img
        src={src}
        alt={name || 'User'}
        loading="lazy"
        decoding="async"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      {online && (
        <div style={{
          position: 'absolute',
          bottom: 1,
          right: 1,
          width: Math.max(8, size * 0.2),
          height: Math.max(8, size * 0.2),
          borderRadius: '50%',
          background: '#22C55E',
          border: '2px solid #060606',
        }} />
      )}
    </div>
  )
}
