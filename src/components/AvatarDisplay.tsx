'use client'

export interface AvatarConfig {
  body?: string
  hair?: string
  outfit?: string
  accessory?: string
}

const ARCHETYPE_COLORS: Record<string, string> = {
  closer:    '#FFB800',
  duelist:   '#f87171',
  architect: '#60a5fa',
  comeback:  '#fb923c',
  founder:   '#FFB800',
  icon:      '#a78bfa',
}

// Maps item IDs to display emojis and body colors
const BODY_MAP: Record<string, { emoji: string; color: string }> = {
  body_default: { emoji: '🧑', color: '#2a2a2a' },
  body_warrior: { emoji: '🧑‍⚔️', color: '#1e293b' },
  body_shadow:  { emoji: '🥷', color: '#111111' },
}
const HAIR_MAP: Record<string, string> = {
  hair_default: '',
  hair_spiky:   '⚡',
  hair_flow:    '🌊',
}
const OUTFIT_MAP: Record<string, string> = {
  outfit_default:   '👕',
  outfit_founder:   '👔',
  outfit_champion:  '🏆',
}
const ACC_MAP: Record<string, string> = {
  acc_none:    '',
  acc_glasses: '🕶️',
  acc_crown:   '👑',
}

interface Props {
  config?: AvatarConfig | null
  archetype?: string
  size?: number
  initials?: string
}

export default function AvatarDisplay({ config, archetype = 'founder', size = 90, initials = 'U' }: Props) {
  const archetypeColor = ARCHETYPE_COLORS[archetype] || '#FFB800'
  const bodyId = config?.body || 'body_default'
  const hairId = config?.hair || 'hair_default'
  const outfitId = config?.outfit || 'outfit_default'
  const accessoryId = config?.accessory || 'acc_none'

  const body = BODY_MAP[bodyId] || BODY_MAP.body_default
  const hairEmoji = HAIR_MAP[hairId] ?? ''
  const outfitEmoji = OUTFIT_MAP[outfitId] ?? '👕'
  const accEmoji = ACC_MAP[accessoryId] ?? ''

  const innerSize = size * 0.78
  const fontSize = size * 0.32
  const badgeSize = size * 0.32

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* Outer ring */}
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${archetypeColor}88, ${archetypeColor}22)`,
        boxShadow: `0 0 0 2px ${archetypeColor}, 0 0 20px ${archetypeColor}44`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Inner circle (body color) */}
        <div style={{
          width: innerSize,
          height: innerSize,
          borderRadius: '50%',
          background: body.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Body emoji or initials fallback */}
          <span style={{ fontSize: fontSize, lineHeight: 1 }}>
            {body.emoji !== '🧑' ? body.emoji : initials}
          </span>
          {/* Hair overlay */}
          {hairEmoji && (
            <span style={{
              position: 'absolute',
              top: 2,
              right: size * 0.06,
              fontSize: fontSize * 0.45,
              lineHeight: 1
            }}>
              {hairEmoji}
            </span>
          )}
          {/* Outfit badge */}
          {outfitEmoji && (
            <span style={{
              position: 'absolute',
              bottom: 2,
              fontSize: fontSize * 0.38,
              lineHeight: 1,
              opacity: 0.9,
            }}>
              {outfitEmoji}
            </span>
          )}
        </div>
      </div>
      {/* Accessory badge (bottom-right) */}
      {accEmoji && (
        <div style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: badgeSize,
          height: badgeSize,
          borderRadius: '50%',
          background: '#111',
          border: `2px solid #060606`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: badgeSize * 0.55,
        }}>
          {accEmoji}
        </div>
      )}
    </div>
  )
}
