'use client'
import React, { useState } from 'react'

/**
 * ProfileImage — Drop-in replacement for UserAvatar.
 * Circular profile photo with fallback to first-letter initial.
 * Used everywhere: header, chat, comments, profiles, discover, leaderboard.
 *
 * DO NOT use for VS Battle Cards — those use AvatarFrame (FIFA card system).
 */
interface ProfileImageProps {
  size?: number
  avatarUrl?: string | null
  name?: string
  /** Gold border ring */
  goldBorder?: boolean
  /** Custom border color (overrides goldBorder) */
  borderColor?: string
  /** Green online indicator dot */
  online?: boolean
  /** onClick handler */
  onClick?: () => void
}

export default function ProfileImage({
  size = 40,
  avatarUrl,
  name,
  goldBorder = false,
  borderColor,
  online = false,
  onClick,
}: ProfileImageProps) {
  const [imgError, setImgError] = useState(false)
  const hasImage = !!avatarUrl && !imgError
  const initial = (name || '?').charAt(0).toUpperCase()

  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: hasImage ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #FFB800, #FF8C00)',
        flexShrink: 0,
        border: borderColor ? `2px solid ${borderColor}` : goldBorder ? '2px solid var(--gold-glow)' : 'none',
        cursor: onClick ? 'pointer' : undefined,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {hasImage ? (
        <img
          src={avatarUrl!}
          alt={name || 'User'}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: Math.max(10, size * 0.38),
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1,
          textTransform: 'uppercase',
          userSelect: 'none',
          textShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}>
          {initial}
        </span>
      )}
      {online && (
        <div style={{
          position: 'absolute',
          bottom: goldBorder ? 0 : 1,
          right: goldBorder ? 0 : 1,
          width: Math.max(8, size * 0.22),
          height: Math.max(8, size * 0.22),
          borderRadius: '50%',
          background: '#22C55E',
          border: '2px solid var(--bg-base)',
        }} />
      )}
    </div>
  )
}
