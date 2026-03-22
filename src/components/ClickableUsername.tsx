'use client'
import React from 'react'
import { useRouter } from 'next/navigation'

/**
 * ClickableUsername — tappable username that navigates to /app/profile/[username].
 * Use anywhere a username is shown: deal cards, comments, feed, etc.
 * Uses router.push with e.stopPropagation to work inside parent Links.
 */
interface ClickableUsernameProps {
  username: string
  displayName?: string
  showAt?: boolean
  fontSize?: number
  color?: string
  fontWeight?: number | string
  maxWidth?: number | string
}

export default function ClickableUsername({
  username,
  displayName,
  showAt = true,
  fontSize = 12,
  color = 'var(--text-primary)',
  fontWeight = 600,
  maxWidth,
}: ClickableUsernameProps) {
  const router = useRouter()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    router.push(`/app/profile/${username}`)
  }

  return (
    <span
      onClick={handleClick}
      style={{
        fontSize,
        fontWeight,
        color,
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth,
        display: 'inline-block',
      }}
    >
      {showAt ? '@' : ''}{displayName || username}
    </span>
  )
}
