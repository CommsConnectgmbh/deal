'use client'

export interface AvatarConfig {
  body?: string
  hair?: string
  outfit?: string
  accessory?: string
}

// ─── Archetype ring colors ────────────────────────────────────────────────────
const ARCHETYPE_COLORS: Record<string, string> = {
  closer:    '#FFB800',
  duelist:   '#f87171',
  architect: '#60a5fa',
  comeback:  '#fb923c',
  founder:   '#FFB800',
  icon:      '#a78bfa',
}

// ─── Rarity glow colors ───────────────────────────────────────────────────────
export const RARITY_COLORS = {
  common:    '#9CA3AF',
  rare:      '#3B82F6',
  epic:      '#8B5CF6',
  legendary: '#F59E0B',
}

// ─── Body (skin) data ─────────────────────────────────────────────────────────
const BODY_DATA: Record<string, {
  skin: string
  eye: string
  hair: string
  rarity: keyof typeof RARITY_COLORS
  aura?: string
}> = {
  body_default: { skin: '#C8956C', eye: '#2A1208', hair: '#2A1209', rarity: 'common' },
  body_warrior: { skin: '#8B6B3D', eye: '#4A1A08', hair: '#1A0800', rarity: 'rare'   },
  body_shadow:  { skin: '#4A4A6A', eye: '#8B2FC8', hair: '#0A0A1E', rarity: 'epic', aura: '#8B5CF6' },
}

// ─── SVG Layer Components ─────────────────────────────────────────────────────

/** Full-body skin layer: torso silhouette + head + neck + hands */
function SkinLayer({ skin, eye }: { skin: string; eye: string }) {
  return (
    <g>
      {/* Wrists / hands visible at sleeve cuffs */}
      <ellipse cx="16" cy="92" rx="5" ry="6.5" fill={skin} />
      <ellipse cx="84" cy="92" rx="5" ry="6.5" fill={skin} />
      {/* Neck */}
      <path d="M44 39 L56 39 L57 50 L43 50 Z" fill={skin} />
      {/* Ears */}
      <ellipse cx="33" cy="25" rx="4.5" ry="5.5" fill={skin} />
      <ellipse cx="67" cy="25" rx="4.5" ry="5.5" fill={skin} />
      {/* Head */}
      <circle cx="50" cy="24" r="17" fill={skin} />
      {/* Eyes */}
      <ellipse cx="43" cy="24" rx="2.5" ry="2.8" fill={eye} />
      <ellipse cx="57" cy="24" rx="2.5" ry="2.8" fill={eye} />
      {/* Eye shine */}
      <circle cx="44.2" cy="22.8" r="0.9" fill="rgba(255,255,255,0.65)" />
      <circle cx="58.2" cy="22.8" r="0.9" fill="rgba(255,255,255,0.65)" />
      {/* Nose */}
      <path d="M47.5 29.5 Q50 32 52.5 29.5" stroke={`${eye}55`} strokeWidth="0.9" fill="none" strokeLinecap="round" />
      {/* Mouth */}
      <path d="M45 34 Q50 37 55 34" stroke={`${eye}45`} strokeWidth="1" fill="none" strokeLinecap="round" />
    </g>
  )
}

// ─── Hair layers ──────────────────────────────────────────────────────────────
function HairDefault({ c }: { c: string }) {
  return (
    <path
      d="M33 24 Q33 7 50 6 Q67 7 67 24 Q63 16 50 15 Q37 16 33 24Z"
      fill={c}
    />
  )
}

function HairSpiky({ c }: { c: string }) {
  return (
    <g fill={c}>
      {/* Base cap */}
      <path d="M33 24 Q33 7 50 6 Q67 7 67 24 Q63 16 50 15 Q37 16 33 24Z" />
      {/* Spikes */}
      <path d="M36 17 L34 1 L43 14 Z" />
      <path d="M46 13 L44 -2 L54 12 Z" />
      <path d="M57 14 L60 0 L65 14 Z" />
      {/* Spike highlight strands */}
      <line x1="36" y1="14" x2="34" y2="3" stroke={`${c}80`} strokeWidth="0.6" />
      <line x1="49" y1="10" x2="48" y2="0" stroke={`${c}80`} strokeWidth="0.6" />
      <line x1="59" y1="11" x2="61" y2="2" stroke={`${c}80`} strokeWidth="0.6" />
    </g>
  )
}

function HairFlow({ c }: { c: string }) {
  return (
    <g fill={c}>
      {/* Main flowing mass */}
      <path d="M33 24 Q29 8 50 6 Q71 8 67 24 L68 60 Q60 67 50 66 Q40 67 32 60 Z" />
      {/* Left cascade */}
      <path d="M33 24 Q26 40 28 58 Q30 65 34 59 Q31 46 33 34 Z" />
      {/* Right cascade */}
      <path d="M67 24 Q74 40 72 58 Q70 65 66 59 Q69 46 67 34 Z" />
      {/* Hair shine */}
      <path d="M40 10 Q48 8 52 10" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </g>
  )
}

// ─── Outfit layers ────────────────────────────────────────────────────────────
function OutfitDefault() {
  return (
    <g>
      {/* T-shirt body */}
      <path d="M28 50 Q50 45 72 50 L76 70 L66 63 L66 107 L34 107 L34 63 L24 70 Z" fill="#1E1E2E" />
      {/* Sleeves */}
      <path d="M28 50 L13 92 L22 95 L32 64 Z" fill="#1E1E2E" />
      <path d="M72 50 L87 92 L78 95 L68 64 Z" fill="#1E1E2E" />
      {/* Collar stitching */}
      <path d="M43 48 Q50 54 57 48" stroke="#16162A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Subtle shirt crease */}
      <line x1="50" y1="56" x2="50" y2="107" stroke="#16162880" strokeWidth="0.6" />
      {/* Jeans */}
      <path d="M34 107 L30 154 L44 155 L50 127 L56 127 L62 155 L70 154 L66 107 Z" fill="#152235" />
      {/* Jean crease / seam */}
      <line x1="50" y1="108" x2="50" y2="127" stroke="#1B2E46" strokeWidth="1" />
      <path d="M34 107 L66 107" stroke="#1B2E4680" strokeWidth="0.6" />
      {/* Sneakers */}
      <path d="M28 153 L46 152 L48 160 L26 161 Z" fill="#111" />
      <rect x="26" y="159" width="22" height="3.5" rx="1" fill="#242424" />
      <path d="M54 153 L72 152 L74 160 L52 161 Z" fill="#111" />
      <rect x="52" y="159" width="22" height="3.5" rx="1" fill="#242424" />
      {/* Shoe lace hint */}
      <path d="M30 155 L44 155" stroke="#33333360" strokeWidth="0.8" />
      <path d="M56 155 L70 155" stroke="#33333360" strokeWidth="0.8" />
    </g>
  )
}

function OutfitFounder() {
  return (
    <g>
      {/* Black jacket body */}
      <path d="M28 50 Q50 45 72 50 L76 70 L66 63 L66 107 L34 107 L34 63 L24 70 Z" fill="#0D0D18" />
      {/* Sleeves - slightly longer */}
      <path d="M28 50 L10 97 L20 100 L32 64 Z" fill="#0D0D18" />
      <path d="M72 50 L90 97 L80 100 L68 64 Z" fill="#0D0D18" />
      {/* Gold lapels (open jacket V) */}
      <path d="M43 48 L50 73 L57 48" fill="none" stroke="#FFB800" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M43 48 L46 68 L50 73 L54 68 L57 48 Q50 58 43 48Z" fill="#FFB80012" />
      {/* Inner shirt glimpse */}
      <path d="M45 51 L50 70 L55 51 Q50 58 45 51Z" fill="#1E1E2E" />
      {/* Button line */}
      <line x1="50" y1="55" x2="50" y2="107" stroke="#FFB80030" strokeWidth="0.8" />
      <circle cx="50" cy="68" r="1.8" fill="#FFB80050" />
      <circle cx="50" cy="81" r="1.8" fill="#FFB80050" />
      <circle cx="50" cy="95" r="1.8" fill="#FFB80050" />
      {/* Gold cuffs */}
      <path d="M9 95 L21 99 L19 104 L7 100 Z" fill="#FFB800" opacity="0.80" />
      <path d="M79 99 L91 95 L93 100 L81 104 Z" fill="#FFB800" opacity="0.80" />
      {/* Jacket pocket */}
      <rect x="36" y="76" width="12" height="9" rx="2" fill="none" stroke="#FFB80025" strokeWidth="0.8" />
      {/* Dark dress pants */}
      <path d="M34 107 L30 154 L44 155 L50 128 L56 128 L62 155 L70 154 L66 107 Z" fill="#0A0A14" />
      <line x1="50" y1="108" x2="50" y2="128" stroke="#111122" strokeWidth="0.8" />
      {/* Tall leather boots */}
      <rect x="27" y="141" width="19" height="21" rx="2" fill="#0A0A0A" />
      <rect x="54" y="141" width="19" height="21" rx="2" fill="#0A0A0A" />
      <path d="M25 159 L46 158 L48 163 L25 164 Z" fill="#151515" />
      <path d="M52 159 L73 158 L75 163 L52 164 Z" fill="#151515" />
      {/* Gold boot trim */}
      <line x1="27" y1="145" x2="46" y2="145" stroke="#FFB80055" strokeWidth="1" />
      <line x1="54" y1="145" x2="73" y2="145" stroke="#FFB80055" strokeWidth="1" />
      {/* Boot highlight */}
      <path d="M29 142 L32 148" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M56 142 L59 148" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  )
}

function OutfitChampion() {
  return (
    <g>
      {/* Armor jacket - deep void purple */}
      <path d="M28 50 Q50 45 72 50 L76 70 L66 63 L66 107 L34 107 L34 63 L24 70 Z" fill="#120825" />
      <path d="M28 50 L12 92 L22 95 L32 64 Z" fill="#120825" />
      <path d="M72 50 L88 92 L78 95 L68 64 Z" fill="#120825" />
      {/* Shoulder armor plates */}
      <path d="M28 50 L23 63 L16 58 L22 46 Z" fill="#1D0E3A" />
      <path d="M72 50 L77 63 L84 58 L78 46 Z" fill="#1D0E3A" />
      <path d="M22 47 L24 62 L17 58 Z" fill="#8B5CF625" />
      <path d="M78 47 L76 62 L83 58 Z" fill="#8B5CF625" />
      {/* Chest armor plate */}
      <path d="M36 57 L64 57 L68 93 L50 99 L32 93 Z" fill="#1D0E3A" />
      {/* Armor panel lines */}
      <line x1="50" y1="57" x2="50" y2="99" stroke="#8B5CF660" strokeWidth="1" />
      <line x1="36" y1="73" x2="64" y2="73" stroke="#8B5CF640" strokeWidth="0.9" />
      <line x1="38" y1="84" x2="62" y2="84" stroke="#8B5CF630" strokeWidth="0.8" />
      {/* Arc reactor / power core */}
      <circle cx="50" cy="73" r="6.5" fill="#8B5CF618" />
      <circle cx="50" cy="73" r="4"   fill="#8B5CF630" />
      <circle cx="50" cy="73" r="2"   fill="#8B5CF660" />
      <circle cx="50" cy="73" r="0.8" fill="#8B5CF6"   opacity="0.9" />
      {/* Energy rings */}
      <circle cx="50" cy="73" r="8" fill="none" stroke="#8B5CF630" strokeWidth="0.8" />
      {/* Track pants */}
      <path d="M34 107 L30 154 L44 155 L50 128 L56 128 L62 155 L70 154 L66 107 Z" fill="#0D0620" />
      {/* Side stripes */}
      <path d="M30 109 L32 154 L36 154 L34 109 Z" fill="#8B5CF645" />
      <path d="M64 109 L68 154 L64 154 L66 109 Z" fill="#8B5CF645" />
      {/* Champion sneakers */}
      <path d="M27 152 L46 151 L48 160 L25 161 Z" fill="#120825" />
      <path d="M54 152 L73 151 L75 160 L52 161 Z" fill="#120825" />
      {/* Purple energy soles */}
      <rect x="25" y="159" width="23" height="3.5" rx="1" fill="#8B5CF6" opacity="0.45" />
      <rect x="52" y="159" width="23" height="3.5" rx="1" fill="#8B5CF6" opacity="0.45" />
      {/* Shoe energy stripe */}
      <path d="M28 154 L42 154" stroke="#8B5CF6" strokeWidth="1" opacity="0.6" strokeLinecap="round" />
      <path d="M58 154 L72 154" stroke="#8B5CF6" strokeWidth="1" opacity="0.6" strokeLinecap="round" />
      {/* Sole glow dots */}
      <circle cx="30" cy="160" r="0.8" fill="#8B5CF6" opacity="0.7" />
      <circle cx="34" cy="160" r="0.8" fill="#8B5CF6" opacity="0.7" />
      <circle cx="56" cy="160" r="0.8" fill="#8B5CF6" opacity="0.7" />
      <circle cx="60" cy="160" r="0.8" fill="#8B5CF6" opacity="0.7" />
    </g>
  )
}

// ─── Accessory layers ─────────────────────────────────────────────────────────
function AccGlasses() {
  return (
    <g>
      {/* Frame arms */}
      <line x1="28" y1="27" x2="32" y2="27" stroke="#60A5FA" strokeWidth="1.5" />
      <line x1="68" y1="27" x2="72" y2="27" stroke="#60A5FA" strokeWidth="1.5" />
      {/* Left lens */}
      <rect x="32" y="22" width="14" height="10" rx="5" fill="none" stroke="#60A5FA" strokeWidth="1.5" />
      <rect x="32" y="22" width="14" height="10" rx="5" fill="#3B82F6" opacity="0.14" />
      {/* Bridge */}
      <line x1="46" y1="27" x2="54" y2="27" stroke="#60A5FA" strokeWidth="1.5" />
      {/* Right lens */}
      <rect x="54" y="22" width="14" height="10" rx="5" fill="none" stroke="#60A5FA" strokeWidth="1.5" />
      <rect x="54" y="22" width="14" height="10" rx="5" fill="#3B82F6" opacity="0.14" />
      {/* Lens shine */}
      <path d="M34 24 L37 23" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" />
      <path d="M56 24 L59 23" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" />
    </g>
  )
}

function AccCrown() {
  return (
    <g>
      {/* Crown main shape */}
      <path d="M32 21 L37 4 L50 15 L63 4 L68 21 Z" fill="#FFB800" />
      {/* Crown band */}
      <rect x="32" y="20" width="36" height="7" rx="2" fill="#E09800" />
      {/* Band highlight */}
      <rect x="32" y="20" width="36" height="2.5" rx="1" fill="#FFD000" opacity="0.6" />
      {/* Gems */}
      <circle cx="37" cy="12" r="3.5" fill="#F87171" />
      <circle cx="50" cy="8"  r="4"   fill="#60A5FA" />
      <circle cx="63" cy="12" r="3.5" fill="#A78BFA" />
      {/* Gem shine */}
      <circle cx="35.8" cy="10.8" r="1.2" fill="rgba(255,255,255,0.6)" />
      <circle cx="48.8" cy="6.8"  r="1.4" fill="rgba(255,255,255,0.6)" />
      <circle cx="61.8" cy="10.8" r="1.2" fill="rgba(255,255,255,0.6)" />
      {/* Vertical lines (crown ridges) */}
      <line x1="37" y1="20" x2="37" y2="7"  stroke="#FFD70035" strokeWidth="0.9" />
      <line x1="50" y1="20" x2="50" y2="7"  stroke="#FFD70035" strokeWidth="0.9" />
      <line x1="63" y1="20" x2="63" y2="7"  stroke="#FFD70035" strokeWidth="0.9" />
      {/* Crown glow */}
      <path d="M32 21 L37 4 L50 15 L63 4 L68 21 Z" fill="none" stroke="#FFB80050" strokeWidth="0.5" />
    </g>
  )
}

// ─── Rendering helpers ────────────────────────────────────────────────────────
function renderOutfit(id: string) {
  if (id === 'outfit_founder')  return <OutfitFounder />
  if (id === 'outfit_champion') return <OutfitChampion />
  return <OutfitDefault />
}

function renderHair(id: string, color: string) {
  if (id === 'hair_spiky') return <HairSpiky c={color} />
  if (id === 'hair_flow')  return <HairFlow  c={color} />
  return <HairDefault c={color} />
}

function renderAcc(id: string) {
  if (id === 'acc_glasses') return <AccGlasses />
  if (id === 'acc_crown')   return <AccCrown />
  return null
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  config?: AvatarConfig | null
  archetype?: string
  size?: number
  initials?: string
  /** Set true in avatar editor to show the full standing figure */
  showFullBody?: boolean
}

export default function AvatarDisplay({
  config,
  archetype = 'founder',
  size = 90,
  initials = 'U',
  showFullBody = false,
}: Props) {
  const bodyId   = config?.body      || 'body_default'
  const hairId   = config?.hair      || 'hair_default'
  const outfitId = config?.outfit    || 'outfit_default'
  const accId    = config?.accessory || 'acc_none'

  const body   = BODY_DATA[bodyId] || BODY_DATA.body_default
  const accent = ARCHETYPE_COLORS[archetype] || '#FFB800'

  // Portrait crop: shows head + upper chest inside the circle
  // Full body: shows the entire standing figure
  const viewBox   = showFullBody ? '0 0 100 165' : '15 3 70 70'
  const svgW      = showFullBody ? size : size * 0.9
  const svgH      = showFullBody ? size * 1.65 : size * 0.9
  const container = showFullBody
    ? {
        width: size,
        height: size * 1.65,
        borderRadius: 20,
        background: 'linear-gradient(180deg, #0D0D18 0%, #060606 100%)',
        boxShadow: `0 0 0 1.5px ${accent}44, 0 0 30px ${accent}22${body.aura ? `, 0 0 60px ${body.aura}22` : ''}`,
        overflow: 'hidden' as const,
        display: 'flex',
        alignItems: 'flex-end' as const,
        justifyContent: 'center' as const,
      }
    : {
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 40% 35%, ${accent}18, #0D0D18 70%)`,
        boxShadow: `0 0 0 2px ${accent}, 0 0 22px ${accent}44${body.aura ? `, 0 0 40px ${body.aura}33` : ''}`,
        overflow: 'hidden' as const,
        display: 'flex',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      }

  return (
    <div style={{ position: 'relative', flexShrink: 0, ...container }}>
      <svg
        viewBox={viewBox}
        width={svgW}
        height={svgH}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <radialGradient id={`bg_${bodyId}`} cx="50%" cy="55%" r="55%">
            <stop offset="0%"   stopColor={accent}    stopOpacity="0.10" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0"  />
          </radialGradient>
          {body.aura && (
            <radialGradient id={`aura_${bodyId}`} cx="50%" cy="35%" r="40%">
              <stop offset="0%"   stopColor={body.aura} stopOpacity="0.20" />
              <stop offset="100%" stopColor={body.aura} stopOpacity="0"  />
            </radialGradient>
          )}
        </defs>

        {/* Ambient background light */}
        <rect x="0" y="0" width="100" height="165" fill={`url(#bg_${bodyId})`} />
        {body.aura && (
          <ellipse cx="50" cy="38" rx="38" ry="32" fill={`url(#aura_${bodyId})`} />
        )}

        {/* ── LAYERS (bottom → top) ── */}
        {/* 1. Outfit (includes bottom, shoes, top) */}
        {renderOutfit(outfitId)}
        {/* 2. Skin (neck, head, hands) – rendered OVER outfit so collar/cuffs show beneath */}
        <SkinLayer skin={body.skin} eye={body.eye} />
        {/* 3. Hair */}
        {renderHair(hairId, body.hair)}
        {/* 4. Accessory */}
        {renderAcc(accId)}
      </svg>

      {/* Ground shadow for full body view */}
      {showFullBody && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '15%',
          right: '15%',
          height: 6,
          background: `radial-gradient(ellipse, ${accent}30 0%, transparent 70%)`,
          borderRadius: '50%',
        }} />
      )}
    </div>
  )
}

// ─── Slot item mini-SVG previews (used in avatar editor grid) ─────────────────

/** Renders a small standalone SVG icon for a given item (used in item cards) */
export function AvatarItemIcon({
  itemId,
  slot,
  size = 56,
  rarity = 'common',
}: {
  itemId: string
  slot: string
  size?: number
  rarity?: string
}) {
  const rc = RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] || RARITY_COLORS.common

  const body   = BODY_DATA['body_default']
  const hairC  = '#2A1209'

  const content = () => {
    if (slot === 'body') {
      // Show just a face with the matching skin tone
      const b = BODY_DATA[itemId] || body
      return (
        <svg viewBox="28 4 44 44" width={size} height={size}>
          <circle cx="50" cy="24" r="17" fill={b.skin} />
          <ellipse cx="33" cy="25" rx="4" ry="5" fill={b.skin} />
          <ellipse cx="67" cy="25" rx="4" ry="5" fill={b.skin} />
          <ellipse cx="43" cy="24" rx="2.2" ry="2.5" fill={b.eye} />
          <ellipse cx="57" cy="24" rx="2.2" ry="2.5" fill={b.eye} />
          <circle cx="44" cy="23" r="0.8" fill="rgba(255,255,255,0.6)" />
          <circle cx="58" cy="23" r="0.8" fill="rgba(255,255,255,0.6)" />
          <path d="M44 34 Q50 37 56 34" stroke={`${b.eye}50`} strokeWidth="1" fill="none" strokeLinecap="round" />
          {itemId === 'body_warrior' && (
            <path d="M44 31 L46 32 L44 33" stroke={`${b.eye}60`} strokeWidth="0.7" fill="none" />
          )}
          {itemId === 'body_shadow' && (
            <ellipse cx="50" cy="24" rx="18" ry="18" fill="none" stroke={RARITY_COLORS.epic} strokeWidth="0.5" opacity="0.4" />
          )}
        </svg>
      )
    }

    if (slot === 'hair') {
      const hColor = itemId === 'hair_spiky' ? '#1A1209' : '#2A1A0A'
      return (
        <svg viewBox="28 -4 44 50" width={size} height={size}>
          <circle cx="50" cy="24" r="17" fill="#C8956C" opacity="0.3" />
          {itemId === 'hair_default' && <HairDefault c={hColor} />}
          {itemId === 'hair_spiky'   && <HairSpiky   c={hColor} />}
          {itemId === 'hair_flow'    && <HairFlow    c={hColor} />}
        </svg>
      )
    }

    if (slot === 'outfit') {
      return (
        <svg viewBox="10 44 80 125" width={size} height={size * 1.2}>
          {itemId === 'outfit_default'  && <OutfitDefault />}
          {itemId === 'outfit_founder'  && <OutfitFounder />}
          {itemId === 'outfit_champion' && <OutfitChampion />}
        </svg>
      )
    }

    if (slot === 'accessory') {
      if (itemId === 'acc_none') {
        return (
          <svg viewBox="28 4 44 44" width={size} height={size}>
            <circle cx="50" cy="24" r="17" fill="#C8956C" opacity="0.25" />
            <text x="50" y="28" textAnchor="middle" fontSize="16" fill="rgba(255,255,255,0.2)">–</text>
          </svg>
        )
      }
      return (
        <svg viewBox="24 0 52 50" width={size} height={size}>
          <circle cx="50" cy="24" r="17" fill="#C8956C" opacity="0.2" />
          {itemId === 'acc_glasses' && <AccGlasses />}
          {itemId === 'acc_crown'   && <AccCrown />}
        </svg>
      )
    }

    return <svg viewBox="0 0 60 60" width={size} height={size} />
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      filter: `drop-shadow(0 0 6px ${rc}55)`,
    }}>
      {content()}
    </div>
  )
}
