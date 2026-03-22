'use client'
import React from 'react'

/* ─── Types ─── */
export type FrameType =
  | 'none' | 'bronze' | 'silver' | 'gold' | 'emerald' | 'sapphire' | 'ruby'
  | 'amethyst' | 'crystal' | 'topaz' | 'legend' | 'icon' | 'obsidian' | 'founder'
  | 'hero' | 'futties' | 'neon' | 'celestial' | 'player_of_the_week'
  | 'winner' | 'winner_50' | 'winner_100'
  | 'dealer' | 'dealer_50' | 'dealer_100'

/** @deprecated Use FrameType instead */
export type FrameRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'founder'

export type FrameSize = 'sm' | 'md' | 'lg'

interface AvatarFrameProps {
  /** New: specific frame type (17 variants) */
  frameType?: FrameType
  /** Legacy: rarity tier (backward compat for VS cards, profiles) */
  rarity?: FrameRarity
  imageUrl?: string | null
  size?: FrameSize
  username?: string
  level?: number
  streak?: number
  serialNumber?: string | null
  showInfo?: boolean
  isWinner?: boolean
  isLoser?: boolean
  children?: React.ReactNode
  avatarUrl?: string
  gender?: 'male' | 'female'
  avatarConfig?: any
  archetype?: string
}

/* ─── Size Map ─── */
const SIZES: Record<FrameSize, { w: number; font: number; lvFont: number }> = {
  sm: { w: 60, font: 10, lvFont: 8 },
  md: { w: 140, font: 13, lvFont: 10 },
  lg: { w: 240, font: 16, lvFont: 12 },
}

/* ─── Frame color + glow config ─── */
const FRAME_CONFIG: Record<FrameType, { color: string; glow: string; animated: boolean }> = {
  none:               { color: 'transparent', glow: 'transparent', animated: false },
  bronze:             { color: '#CD7F32', glow: 'rgba(205,127,50,0.4)',  animated: false },
  silver:             { color: '#C0C0C0', glow: 'rgba(192,192,192,0.4)', animated: false },
  gold:               { color: '#F59E0B', glow: 'rgba(245,158,11,0.5)', animated: false },
  emerald:            { color: '#22C55E', glow: 'rgba(34,197,94,0.5)',   animated: false },
  sapphire:           { color: '#3B82F6', glow: 'rgba(59,130,246,0.5)',  animated: false },
  ruby:               { color: '#EF4444', glow: 'rgba(239,68,68,0.5)',   animated: false },
  amethyst:           { color: '#8B5CF6', glow: 'rgba(139,92,246,0.5)',  animated: false },
  crystal:            { color: '#8B5CF6', glow: 'rgba(139,92,246,0.5)',  animated: false },
  topaz:              { color: '#F97316', glow: 'rgba(249,115,22,0.5)',  animated: false },
  legend:             { color: '#FBBF24', glow: 'rgba(251,191,36,0.6)', animated: true },
  icon:               { color: '#A78BFA', glow: 'rgba(167,139,250,0.6)', animated: true },
  obsidian:           { color: '#6B7280', glow: 'rgba(107,114,128,0.5)', animated: true },
  founder:            { color: '#F59E0B', glow: 'rgba(245,158,11,0.6)', animated: true },
  hero:               { color: '#60A5FA', glow: 'rgba(96,165,250,0.6)', animated: true },
  futties:            { color: '#EC4899', glow: 'rgba(236,72,153,0.6)', animated: true },
  neon:               { color: '#34D399', glow: 'rgba(52,211,153,0.6)', animated: true },
  celestial:          { color: '#E0E7FF', glow: 'rgba(224,231,255,0.5)', animated: true },
  player_of_the_week: { color: '#FBBF24', glow: 'rgba(251,191,36,0.6)', animated: true },
  // Winner milestone frames (25/50/100 wins)
  winner:             { color: '#EAB308', glow: 'rgba(234,179,8,0.5)',   animated: false },
  winner_50:          { color: '#F59E0B', glow: 'rgba(245,158,11,0.6)', animated: true },
  winner_100:         { color: '#FBBF24', glow: 'rgba(251,191,36,0.7)', animated: true },
  // Dealer milestone frames (25/50/100 completed deals)
  dealer:             { color: '#10B981', glow: 'rgba(16,185,129,0.5)', animated: false },
  dealer_50:          { color: '#059669', glow: 'rgba(5,150,105,0.6)',  animated: true },
  dealer_100:         { color: '#10B981', glow: 'rgba(16,185,129,0.7)', animated: true },
}

/* ─── Map old rarity to frame type (backward compat) ─── */
const RARITY_TO_FRAME: Record<FrameRarity, FrameType> = {
  common: 'bronze',
  rare: 'gold',
  epic: 'emerald',
  legendary: 'legend',
  founder: 'founder',
}

/* ─── Legacy helper (deprecated — returns empty string, no static cards) ─── */
export function getCardSrc(_rarity: FrameRarity): string {
  return ''
}

/* ─── Keyframes ─── */
const STYLE_ID = 'card-avatar-keyframes-v2'
function ensureKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    @keyframes ca-crown-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
    @keyframes ca-shimmer-sweep{0%{left:-100%}100%{left:200%}}
    @keyframes ca-frame-glow{0%,100%{opacity:0.6}50%{opacity:1}}
    @keyframes ca-border-rotate{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(360deg)}}
  `
  document.head.appendChild(s)
}

/* ─── Winner Crown SVG ─── */
function CrownSVG({ size }: { size: number }) {
  const s = Math.max(14, size * 0.15)
  return (
    <svg width={s} height={s * 0.8} viewBox="0 0 24 18" style={{
      position: 'absolute', top: -s * 0.6, left: '50%',
      transform: 'translateX(-50%)',
      filter: 'drop-shadow(0 2px 6px rgba(245,158,11,.6))',
      animation: 'ca-crown-bob 2s ease-in-out infinite',
      zIndex: 6,
    }}>
      <path d="M2 16L0 4L6 8L12 2L18 8L24 4L22 16Z" fill="#F59E0B" />
      <path d="M4 14L3 6L7 9L12 4L17 9L21 6L20 14Z" fill="#FBBF24" />
      <circle cx="6" cy="14" r="1.2" fill="#B45309" />
      <circle cx="12" cy="14" r="1.2" fill="#B45309" />
      <circle cx="18" cy="14" r="1.2" fill="#B45309" />
    </svg>
  )
}

/* ─── Placeholder when no image ─── */
function CardPlaceholder({ frame, w }: { frame: FrameType; w: number }) {
  const cfg = FRAME_CONFIG[frame]
  return (
    <div style={{
      width: '100%', aspectRatio: '2/3',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(ellipse at 50% 40%, ${cfg.color}22, #0a0a0a 70%)`,
      borderRadius: 8,
    }}>
      <svg width={w * 0.4} height={w * 0.4} viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="22" r="12" fill={cfg.color} opacity="0.3" />
        <path d="M16 56c0-10 7-18 16-18s16 8 16 18" fill={cfg.color} opacity="0.2" />
      </svg>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   AvatarFrame — Dynamic CSS card frame with 17 frame types
   ═══════════════════════════════════════════════════════ */
export default function AvatarFrame({
  frameType: frameTypeProp,
  rarity,
  imageUrl,
  size = 'md',
  username, level, streak = 0,
  serialNumber,
  showInfo = false, isWinner = false, isLoser = false,
}: AvatarFrameProps) {
  React.useEffect(() => { ensureKeyframes() }, [])

  // Resolve frame type: prefer explicit frameType, fall back to rarity mapping
  const rawFrame = frameTypeProp || (rarity ? RARITY_TO_FRAME[rarity] : 'bronze')
  // Graceful fallback: if frame is not in FRAME_CONFIG, use 'none' to prevent crashes
  const frame: FrameType = (rawFrame in FRAME_CONFIG) ? rawFrame : 'none'
  const cfg = FRAME_CONFIG[frame]
  const { w, font, lvFont } = SIZES[size]

  // Legacy mode: rarity prop without imageUrl — show CSS placeholder frame (no static images)
  const legacyMode = !frameTypeProp && rarity && !imageUrl
  // Legacy mode now falls through to the new CSS frame below (with CardPlaceholder)

  // New mode: dynamic CSS frame
  const borderWidth = frame === 'none' ? 0 : (size === 'sm' ? 2 : size === 'md' ? 3 : 4)
  const isNone = frame === 'none'

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <div style={{
        position: 'relative', width: w,
        filter: isLoser ? 'grayscale(70%) brightness(0.4)' : 'none',
      }}>
        {/* Card frame */}
        <div style={{
          position: 'relative',
          width: '100%', aspectRatio: '2/3',
          borderRadius: isNone ? (size === 'sm' ? 6 : size === 'md' ? 10 : 14) : (size === 'sm' ? 6 : size === 'md' ? 10 : 14),
          border: 'none',
          overflow: 'hidden',
          background: 'transparent',
          animation: cfg.animated ? 'ca-frame-glow 3s ease-in-out infinite' : 'none',
        }}>
          {/* Card image or placeholder */}
          {imageUrl ? (
            <img src={imageUrl} alt={username ? `@${username} card` : 'Card'}
              loading="lazy" decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <CardPlaceholder frame={frame} w={w} />
          )}

          {/* Frame type label (hidden for 'none') */}
          {size !== 'sm' && !isNone && (
            <div style={{
              position: 'absolute', top: size === 'md' ? 6 : 10, left: 0, right: 0,
              textAlign: 'center',
            }}>
              <span style={{
                fontFamily: "'Oswald',sans-serif",
                fontSize: size === 'md' ? 8 : 11,
                fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase',
                color: cfg.color,
                textShadow: `0 0 8px ${cfg.glow}`,
              }}>
                {frame.replace(/_/g, ' ')}
              </span>
            </div>
          )}

          {/* Serial number */}
          {serialNumber && size !== 'sm' && (
            <div style={{
              position: 'absolute', bottom: size === 'md' ? 6 : 10, right: size === 'md' ? 6 : 10,
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: size === 'md' ? 8 : 10,
                color: cfg.color, opacity: 0.8,
              }}>
                {serialNumber}
              </span>
            </div>
          )}

          {/* Animated shimmer overlay for animated frames */}
          {cfg.animated && (
            <div style={{
              position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: '-100%',
                width: '50%', height: '100%',
                background: `linear-gradient(90deg,transparent,${cfg.color}15,transparent)`,
                animation: 'ca-shimmer-sweep 4s ease-in-out infinite',
              }} />
            </div>
          )}

          {/* Winner shimmer */}
          {isWinner && (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 4 }}>
              <div style={{
                position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
                background: 'linear-gradient(90deg,transparent,rgba(245,158,11,.25),transparent)',
                animation: 'ca-shimmer-sweep 2s ease-in-out 1',
              }} />
            </div>
          )}
        </div>
      </div>

      {/* Winner crown */}
      {isWinner && <CrownSVG size={w} />}

      {/* Info below card */}
      {showInfo && (
        <div style={{ textAlign: 'center', marginTop: 6, maxWidth: w + 20 }}>
          {username && (
            <p style={{
              fontFamily: "'Oswald',sans-serif", fontSize: font, fontWeight: 600,
              color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.8)',
              margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              @{username}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2 }}>
            {level !== undefined && <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: lvFont, color: '#9CA3AF' }}>LV. {level}</span>}
            {streak > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: lvFont, color: '#F59E0B' }}>🔥{streak}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
