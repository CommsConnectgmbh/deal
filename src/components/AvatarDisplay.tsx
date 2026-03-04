'use client'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AvatarConfig {
  skin_tone?:  string
  hair?:       string
  headwear?:   string | null
  top?:        string
  bottom?:     string
  shoes?:      string
  accessory?:  string
  background?: string
  // legacy compat
  body?:       string
  outfit?:     string
}

// ─── Skin Tones ───────────────────────────────────────────────────────────────
export const SKIN_TONES: Record<string, { skin: string; eye: string; lip: string }> = {
  skin_light:        { skin: '#F5DEB3', eye: '#3B2314', lip: '#C9826E' },
  skin_medium_light: { skin: '#DEB887', eye: '#2A1708', lip: '#B8705A' },
  skin_medium:       { skin: '#C68642', eye: '#1E0E05', lip: '#A0583A' },
  skin_medium_dark:  { skin: '#8D5524', eye: '#150A02', lip: '#7A3E25' },
  skin_dark:         { skin: '#5C3A1E', eye: '#0D0602', lip: '#4A2A14' },
  // legacy
  body_default:      { skin: '#C8956C', eye: '#2A1208', lip: '#A0623C' },
  body_warrior:      { skin: '#8B6B3D', eye: '#4A1A08', lip: '#7A4A28' },
  body_shadow:       { skin: '#4A4A6A', eye: '#8B2FC8', lip: '#5A3A7A' },
}

const getSkin = (id?: string) =>
  SKIN_TONES[id || 'skin_medium'] || SKIN_TONES.skin_medium

// ─── Rarity ───────────────────────────────────────────────────────────────────
export const RARITY_COLORS = {
  common:    '#9CA3AF',
  rare:      '#3B82F6',
  epic:      '#8B5CF6',
  legendary: '#F59E0B',
}

// ─── Background SVGs ──────────────────────────────────────────────────────────
function BgDark() {
  return (
    <rect x="0" y="0" width="100" height="165"
      fill="url(#bg_dark_grad)" />
  )
}
function BgGold() {
  return (
    <>
      <rect x="0" y="0" width="100" height="165" fill="#0D0A00" />
      <ellipse cx="50" cy="82" rx="48" ry="80"
        fill="none" stroke="#FFB800" strokeWidth="1.5" opacity="0.4" />
      <ellipse cx="50" cy="82" rx="42" ry="72"
        fill="none" stroke="#FFB800" strokeWidth="0.5" opacity="0.2" />
      <radialGradient id="gold_bg_g" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFB800" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#FFB800" stopOpacity="0" />
      </radialGradient>
      <ellipse cx="50" cy="50" rx="50" ry="80" fill="url(#gold_bg_g)" />
    </>
  )
}
function BgSmoke() {
  return (
    <>
      <rect x="0" y="0" width="100" height="165" fill="#0A0A0F" />
      <ellipse cx="25" cy="130" rx="30" ry="20" fill="#1A1A2A" opacity="0.6" />
      <ellipse cx="75" cy="120" rx="35" ry="25" fill="#1A1A2A" opacity="0.5" />
      <ellipse cx="50" cy="140" rx="40" ry="18" fill="#1E1E2E" opacity="0.7" />
      <ellipse cx="30" cy="90"  rx="20" ry="30" fill="#14141E" opacity="0.4" />
      <ellipse cx="70" cy="85"  rx="18" ry="28" fill="#14141E" opacity="0.4" />
    </>
  )
}

// ─── Skin / Body Layer ────────────────────────────────────────────────────────
function SkinLayer({ skin, eye, lip }: { skin: string; eye: string; lip: string }) {
  return (
    <g>
      {/* Hands */}
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
      <circle cx="44.2" cy="22.8" r="0.9" fill="rgba(255,255,255,0.65)" />
      <circle cx="58.2" cy="22.8" r="0.9" fill="rgba(255,255,255,0.65)" />
      {/* Nose */}
      <path d="M47.5 29.5 Q50 32 52.5 29.5" stroke={`${eye}55`} strokeWidth="0.9" fill="none" strokeLinecap="round" />
      {/* Mouth */}
      <path d="M45.5 34 Q50 36.5 54.5 34" stroke={lip} strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </g>
  )
}

// ─── Hair Styles ──────────────────────────────────────────────────────────────
const HAIR_COLORS: Record<string, string> = {
  black:    '#1A1009',
  brown:    '#3D1F0A',
  blonde:   '#C8A43C',
  platinum: '#E8E0C0',
  red:      '#6B1A0A',
}
const DEFAULT_HAIR_COLOR = HAIR_COLORS.black

function HairShortTextured({ c }: { c: string }) {
  return (
    <g fill={c}>
      <path d="M33 24 Q33 7 50 6 Q67 7 67 24 Q63 16 50 15 Q37 16 33 24Z" />
      <path d="M33 24 Q35 19 38 17 L37 14 L40 18 Q42 16 44 15 L44 12 L46 16 Q48 14 50 14 L50 11 L52 15 Q54 14 56 15 L56 12 L58 16 Q60 16 63 19 L62 14 L65 20 Q67 14 67 24 Z" opacity="0.5" />
    </g>
  )
}
function HairBuzzcut({ c }: { c: string }) {
  return (
    <g fill={c}>
      <path d="M34 26 Q33 10 50 8 Q67 10 66 26 Q63 18 50 17 Q37 18 34 26Z" opacity="0.85" />
      {/* Stubble texture lines */}
      <line x1="37" y1="18" x2="38" y2="14" stroke={c} strokeWidth="0.8" opacity="0.5" />
      <line x1="43" y1="15" x2="44" y2="11" stroke={c} strokeWidth="0.8" opacity="0.5" />
      <line x1="50" y1="14" x2="50" y2="10" stroke={c} strokeWidth="0.8" opacity="0.5" />
      <line x1="57" y1="15" x2="58" y2="11" stroke={c} strokeWidth="0.8" opacity="0.5" />
      <line x1="63" y1="18" x2="64" y2="14" stroke={c} strokeWidth="0.8" opacity="0.5" />
    </g>
  )
}
function HairMediumWavy({ c }: { c: string }) {
  return (
    <g fill={c}>
      <path d="M33 24 Q29 8 50 6 Q71 8 67 24 L68 54 Q60 60 50 59 Q40 60 32 54 Z" />
      <path d="M33 24 Q26 38 28 52 Q30 60 34 54 Q31 42 33 32 Z" />
      <path d="M67 24 Q74 38 72 52 Q70 60 66 54 Q69 42 67 32 Z" />
      {/* Waves */}
      <path d="M33 35 Q37 31 41 35 Q45 39 49 35 Q53 31 57 35 Q61 39 65 35 L65 37 Q61 41 57 37 Q53 33 49 37 Q45 41 41 37 Q37 33 33 37 Z" fill={c} opacity="0.4" />
      <path d="M40 10 Q48 8 52 10" stroke="rgba(255,255,255,0.1)" strokeWidth="1" fill="none" strokeLinecap="round" />
    </g>
  )
}
function HairBraids({ c }: { c: string }) {
  return (
    <g>
      <path d="M33 24 Q33 7 50 6 Q67 7 67 24 Q63 16 50 15 Q37 16 33 24Z" fill={c} />
      {/* Left braid */}
      <path d="M33 26 Q28 35 29 45 Q31 55 33 65" stroke={c} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M33 26 Q31 35 33 45 Q35 55 33 65" stroke={`${c}80`} strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="3 2" />
      {/* Right braid */}
      <path d="M67 26 Q72 35 71 45 Q69 55 67 65" stroke={c} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M67 26 Q69 35 67 45 Q65 55 67 65" stroke={`${c}80`} strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="3 2" />
      {/* Braid tips */}
      <ellipse cx="31" cy="68" rx="3" ry="2" fill={c} />
      <ellipse cx="69" cy="68" rx="3" ry="2" fill={c} />
    </g>
  )
}
function HairSlickedBack({ c }: { c: string }) {
  return (
    <g fill={c}>
      <path d="M33 24 Q33 7 50 6 Q67 7 67 24 Q67 12 60 9 Q50 6 40 9 Q33 12 33 24Z" />
      {/* Slick lines going back */}
      <path d="M34 20 Q42 10 55 9 Q62 10 66 16" stroke={`${c}60`} strokeWidth="0.8" fill="none" strokeLinecap="round" />
      <path d="M35 22 Q43 12 56 11 Q63 13 66 18" stroke={`${c}40`} strokeWidth="0.7" fill="none" strokeLinecap="round" />
      {/* Shine */}
      <path d="M38 15 Q44 11 50 10" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </g>
  )
}

function renderHair(id?: string) {
  const c = DEFAULT_HAIR_COLOR
  switch (id) {
    case 'hair_short_textured': return <HairShortTextured c={c} />
    case 'hair_default':        return <HairShortTextured c={c} />
    case 'hair_buzzcut':        return <HairBuzzcut c={c} />
    case 'hair_medium_wavy':    return <HairMediumWavy c={c} />
    case 'hair_braids':         return <HairBraids c={c} />
    case 'hair_slicked_back':   return <HairSlickedBack c={c} />
    case 'hair_spiky':          return <HairShortTextured c={c} />
    case 'hair_flow':           return <HairMediumWavy c={c} />
    default:                    return <HairShortTextured c={c} />
  }
}

// ─── Headwear ─────────────────────────────────────────────────────────────────
function HeadwearCap() {
  return (
    <g>
      {/* Bill */}
      <path d="M28 26 Q28 16 50 15 Q72 16 72 26 L72 30 Q65 28 50 28 Q35 28 28 30 Z" fill="#1A1A2A" />
      <path d="M20 29 Q28 28 28 30 L35 30 Q30 32 20 31 Z" fill="#1A1A2A" />
      {/* Visor */}
      <path d="M22 30 L38 30 Q30 35 20 33 Z" fill="#111120" />
      {/* Strap */}
      <rect x="28" y="29" width="44" height="4" rx="2" fill="#141424" />
      {/* Logo dot */}
      <circle cx="50" cy="22" r="2.5" fill="#FFB800" opacity="0.7" />
    </g>
  )
}
function HeadwearBeanie() {
  return (
    <g>
      <path d="M32 30 Q30 8 50 7 Q70 8 68 30 Q60 26 50 26 Q40 26 32 30 Z" fill="#2A2A4A" />
      {/* Knit lines */}
      <path d="M34 28 Q50 24 66 28" stroke="#3A3A5A" strokeWidth="1" fill="none" />
      <path d="M33 23 Q50 19 67 23" stroke="#3A3A5A" strokeWidth="1" fill="none" />
      <path d="M34 18 Q50 14 66 18" stroke="#3A3A5A" strokeWidth="1" fill="none" />
      {/* Fold/cuff */}
      <path d="M32 30 Q40 33 50 33 Q60 33 68 30 L68 35 Q60 38 50 38 Q40 38 32 35 Z" fill="#1E1E3A" />
      {/* Pom pom */}
      <circle cx="50" cy="8"  r="5" fill="#3A3A5A" />
      <circle cx="48" cy="7"  r="3" fill="#4A4A6A" opacity="0.6" />
    </g>
  )
}
function HeadwearBandana() {
  return (
    <g>
      {/* Main bandana wrap */}
      <path d="M33 24 Q33 12 50 11 Q67 12 67 24 Q63 20 50 20 Q37 20 33 24 Z" fill="#8B1A1A" />
      {/* Knot on back (visible side) */}
      <path d="M66 20 L73 15 L72 22 Z" fill="#6B1010" />
      {/* Pattern stripes */}
      <path d="M34 22 Q50 18 66 22" stroke="#6B0A0A" strokeWidth="1.5" fill="none" opacity="0.6" />
      <path d="M35 19 Q50 15 65 19" stroke="#6B0A0A" strokeWidth="1" fill="none" opacity="0.4" />
      {/* Bandana edge */}
      <path d="M33 24 Q33 12 50 11 Q67 12 67 24" fill="none" stroke="#7A1515" strokeWidth="0.8" />
    </g>
  )
}

function renderHeadwear(id?: string | null) {
  if (!id) return null
  switch (id) {
    case 'hw_cap':     return <HeadwearCap />
    case 'hw_beanie':  return <HeadwearBeanie />
    case 'hw_bandana': return <HeadwearBandana />
    default:           return null
  }
}

// ─── Tops ─────────────────────────────────────────────────────────────────────
function TopTShirt() {
  return (
    <g>
      <path d="M28 50 Q50 45 72 50 L76 70 L66 63 L66 107 L34 107 L34 63 L24 70 Z" fill="#1E1E2E" />
      <path d="M28 50 L13 92 L22 95 L32 64 Z" fill="#1E1E2E" />
      <path d="M72 50 L87 92 L78 95 L68 64 Z" fill="#1E1E2E" />
      <path d="M43 48 Q50 54 57 48" stroke="#16162A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <line x1="50" y1="56" x2="50" y2="107" stroke="#16162880" strokeWidth="0.6" />
    </g>
  )
}
function TopHoodie() {
  return (
    <g>
      {/* Hoodie body */}
      <path d="M26 50 Q50 44 74 50 L78 75 L66 65 L66 107 L34 107 L34 65 L22 75 Z" fill="#1A1A2E" />
      <path d="M26 50 L10 96 L21 99 L32 66 Z" fill="#1A1A2E" />
      <path d="M74 50 L90 96 L79 99 L68 66 Z" fill="#1A1A2E" />
      {/* Hood on back/top */}
      <path d="M38 48 Q50 42 62 48 Q62 38 50 36 Q38 38 38 48 Z" fill="#141422" />
      {/* Center front pocket */}
      <path d="M36 82 Q50 80 64 82 L64 100 Q50 102 36 100 Z" fill="#141422" />
      {/* Kangaroo pocket divider */}
      <line x1="50" y1="81" x2="50" y2="101" stroke="#1C1C30" strokeWidth="0.8" />
      {/* Front zip line */}
      <line x1="50" y1="49" x2="50" y2="82" stroke="#1C1C30" strokeWidth="0.9" />
      {/* Ribbed cuffs */}
      <path d="M10 94 L21 97 L21 102 L10 99 Z" fill="#141422" />
      <path d="M79 97 L90 94 L90 99 L79 102 Z" fill="#141422" />
      {/* Drawstrings */}
      <path d="M44 49 L42 58 L41 65" stroke="#333350" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      <path d="M56 49 L58 58 L59 65" stroke="#333350" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </g>
  )
}
function TopBomber() {
  return (
    <g>
      {/* Bomber body */}
      <path d="M27 50 Q50 44 73 50 L77 72 L66 63 L66 107 L34 107 L34 63 L23 72 Z" fill="#0A1A0A" />
      <path d="M27 50 L11 93 L22 96 L32 65 Z" fill="#0A1A0A" />
      <path d="M73 50 L89 93 L78 96 L68 65 Z" fill="#0A1A0A" />
      {/* Ribbed collar */}
      <path d="M38 49 Q50 53 62 49 Q60 46 50 45 Q40 46 38 49 Z" fill="#051005" />
      {/* Chest stripe */}
      <path d="M27 60 L73 60 L73 66 L27 66 Z" fill="#1A3A1A" opacity="0.7" />
      {/* Arm stripes */}
      <path d="M11 70 L22 73 L22 78 L11 75 Z" fill="#1A3A1A" opacity="0.7" />
      <path d="M78 73 L89 70 L89 75 L78 78 Z" fill="#1A3A1A" opacity="0.7" />
      {/* Front zip */}
      <line x1="50" y1="50" x2="50" y2="107" stroke="#051005" strokeWidth="1.2" />
      {/* Zip pull */}
      <rect x="48" y="58" width="4" height="3" rx="1" fill="#333" />
      {/* Ribbed hem */}
      <path d="M34 103 L66 103 L66 107 L34 107 Z" fill="#051005" />
      {/* Ribbed cuffs */}
      <path d="M10 91 L21 94 L21 99 L10 96 Z" fill="#051005" />
      <path d="M79 94 L90 91 L90 96 L79 99 Z" fill="#051005" />
    </g>
  )
}
function TopZipHoodie() {
  return (
    <g>
      <path d="M26 50 Q50 44 74 50 L78 75 L66 65 L66 107 L34 107 L34 65 L22 75 Z" fill="#1A1A2E" />
      <path d="M26 50 L10 96 L21 99 L32 66 Z" fill="#1A1A2E" />
      <path d="M74 50 L90 96 L79 99 L68 66 Z" fill="#1A1A2E" />
      {/* Open zip + lapels */}
      <path d="M44 48 L50 65 L44 48 Z" fill="#0A0A1A" />
      <path d="M56 48 L50 65 L56 48 Z" fill="#0A0A1A" />
      <path d="M44 48 L40 80 L50 85 L60 80 L56 48" fill="none" stroke="#111128" strokeWidth="0.8" />
      {/* Left panel */}
      <path d="M34 63 L34 107 L50 107 L50 85 L40 80 L34 63 Z" fill="#141422" opacity="0.3" />
      <line x1="50" y1="65" x2="50" y2="107" stroke="#111128" strokeWidth="1" />
    </g>
  )
}
function TopDenim() {
  return (
    <g>
      <path d="M27 50 Q50 44 73 50 L77 72 L66 63 L66 107 L34 107 L34 63 L23 72 Z" fill="#1A2A4A" />
      <path d="M27 50 L11 93 L22 96 L32 65 Z" fill="#1A2A4A" />
      <path d="M73 50 L89 93 L78 96 L68 65 Z" fill="#1A2A4A" />
      {/* Denim collar */}
      <path d="M38 49 Q50 54 62 49 Q56 46 50 45 Q44 46 38 49 Z" fill="#1E3050" />
      {/* Chest pockets */}
      <rect x="35" y="60" width="12" height="10" rx="1.5" fill="none" stroke="#253858" strokeWidth="0.9" />
      <rect x="53" y="60" width="12" height="10" rx="1.5" fill="none" stroke="#253858" strokeWidth="0.9" />
      {/* Pocket flap lines */}
      <path d="M35 64 L47 64" stroke="#253858" strokeWidth="0.7" />
      <path d="M53 64 L65 64" stroke="#253858" strokeWidth="0.7" />
      {/* Button line */}
      <line x1="50" y1="50" x2="50" y2="107" stroke="#253858" strokeWidth="0.8" />
      <circle cx="50" cy="56" r="1.2" fill="#253858" />
      <circle cx="50" cy="65" r="1.2" fill="#253858" />
      <circle cx="50" cy="74" r="1.2" fill="#253858" />
      {/* Seam lines */}
      <path d="M27 58 L32 58" stroke="#253858" strokeWidth="0.7" />
      <path d="M68 58 L73 58" stroke="#253858" strokeWidth="0.7" />
    </g>
  )
}
// Keep legacy outfits
function OutfitFounder() {
  return (
    <g>
      <path d="M28 50 Q50 45 72 50 L76 70 L66 63 L66 107 L34 107 L34 63 L24 70 Z" fill="#0D0D18" />
      <path d="M28 50 L10 97 L20 100 L32 64 Z" fill="#0D0D18" />
      <path d="M72 50 L90 97 L80 100 L68 64 Z" fill="#0D0D18" />
      <path d="M43 48 L50 73 L57 48" fill="none" stroke="#FFB800" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M43 48 L46 68 L50 73 L54 68 L57 48 Q50 58 43 48Z" fill="#FFB80012" />
      <path d="M45 51 L50 70 L55 51 Q50 58 45 51Z" fill="#1E1E2E" />
      <line x1="50" y1="55" x2="50" y2="107" stroke="#FFB80030" strokeWidth="0.8" />
      <circle cx="50" cy="68" r="1.8" fill="#FFB80050" />
      <circle cx="50" cy="81" r="1.8" fill="#FFB80050" />
      <circle cx="50" cy="95" r="1.8" fill="#FFB80050" />
      <path d="M9 95 L21 99 L19 104 L7 100 Z" fill="#FFB800" opacity="0.8" />
      <path d="M79 99 L91 95 L93 100 L81 104 Z" fill="#FFB800" opacity="0.8" />
      <rect x="36" y="76" width="12" height="9" rx="2" fill="none" stroke="#FFB80025" strokeWidth="0.8" />
      <path d="M34 107 L30 154 L44 155 L50 128 L56 128 L62 155 L70 154 L66 107 Z" fill="#0A0A14" />
      <line x1="50" y1="108" x2="50" y2="128" stroke="#111122" strokeWidth="0.8" />
      <rect x="27" y="141" width="19" height="21" rx="2" fill="#0A0A0A" />
      <rect x="54" y="141" width="19" height="21" rx="2" fill="#0A0A0A" />
      <path d="M25 159 L46 158 L48 163 L25 164 Z" fill="#151515" />
      <path d="M52 159 L73 158 L75 163 L52 164 Z" fill="#151515" />
      <line x1="27" y1="145" x2="46" y2="145" stroke="#FFB80055" strokeWidth="1" />
      <line x1="54" y1="145" x2="73" y2="145" stroke="#FFB80055" strokeWidth="1" />
    </g>
  )
}

function renderTop(id?: string) {
  switch (id) {
    case 'top_hoodie':    return <TopHoodie />
    case 'top_bomber':    return <TopBomber />
    case 'top_zip':       return <TopZipHoodie />
    case 'top_denim':     return <TopDenim />
    case 'outfit_founder':return <OutfitFounder />
    case 'top_tshirt':
    case 'outfit_default':
    default:              return <TopTShirt />
  }
}

// ─── Bottoms ──────────────────────────────────────────────────────────────────
function BottomSlim() {
  return (
    <g>
      <path d="M34 107 L30 154 L44 155 L50 127 L56 127 L62 155 L70 154 L66 107 Z" fill="#152235" />
      <line x1="50" y1="108" x2="50" y2="127" stroke="#1B2E46" strokeWidth="1" />
      <path d="M34 107 L66 107" stroke="#1B2E4680" strokeWidth="0.6" />
    </g>
  )
}
function BottomJogger() {
  return (
    <g>
      <path d="M34 107 L31 150 L45 151 L50 128 L55 128 L59 151 L69 150 L66 107 Z" fill="#1E1E30" />
      {/* Side stripes */}
      <path d="M32 109 L33 150 L37 150 L36 109 Z" fill="#3A3A5A" opacity="0.6" />
      <path d="M64 109 L67 150 L63 150 L64 109 Z" fill="#3A3A5A" opacity="0.6" />
      {/* Ankle cuffs */}
      <ellipse cx="38" cy="151" rx="7" ry="3" fill="#141422" />
      <ellipse cx="62" cy="151" rx="7" ry="3" fill="#141422" />
      <line x1="50" y1="108" x2="50" y2="128" stroke="#252540" strokeWidth="0.8" />
    </g>
  )
}
function BottomCargo() {
  return (
    <g>
      <path d="M34 107 L30 154 L44 155 L50 127 L56 127 L62 155 L70 154 L66 107 Z" fill="#1A2A1A" />
      {/* Cargo pockets left */}
      <rect x="31" y="118" width="10" height="14" rx="1" fill="#152015" />
      <path d="M31 123 L41 123" stroke="#1A2A1A" strokeWidth="0.7" />
      <rect x="32" y="119" width="8" height="4" rx="0.5" fill="#101A10" />
      {/* Cargo pockets right */}
      <rect x="59" y="118" width="10" height="14" rx="1" fill="#152015" />
      <path d="M59 123 L69 123" stroke="#1A2A1A" strokeWidth="0.7" />
      <rect x="60" y="119" width="8" height="4" rx="0.5" fill="#101A10" />
      {/* Seams */}
      <line x1="50" y1="108" x2="50" y2="127" stroke="#152015" strokeWidth="0.9" />
      <path d="M34 107 L66 107" stroke="#152015" strokeWidth="0.7" />
    </g>
  )
}
function BottomShorts() {
  return (
    <g>
      <path d="M34 107 L33 135 L46 136 L50 122 L54 122 L57 136 L67 135 L66 107 Z" fill="#152235" />
      {/* Side stripes */}
      <path d="M34 108 L34 135 L37 135 L37 108 Z" fill="#1E2E46" opacity="0.6" />
      <path d="M63 108 L66 108 L66 135 L63 135 Z" fill="#1E2E46" opacity="0.6" />
      {/* Hem */}
      <path d="M33 133 L46 134 L50 136 L54 134 L67 133 L67 136 Q57 138 50 138 Q43 138 33 136 Z" fill="#1A2A40" />
      <line x1="50" y1="108" x2="50" y2="122" stroke="#1A2A40" strokeWidth="0.8" />
    </g>
  )
}

function renderBottom(id?: string) {
  switch (id) {
    case 'bottom_jogger': return <BottomJogger />
    case 'bottom_cargo':  return <BottomCargo />
    case 'bottom_shorts': return <BottomShorts />
    default:              return <BottomSlim />
  }
}

// ─── Shoes ────────────────────────────────────────────────────────────────────
function ShoeSneaker() {
  return (
    <g>
      <path d="M28 153 L46 152 L48 160 L26 161 Z" fill="#111" />
      <rect x="26" y="159" width="22" height="3.5" rx="1" fill="#242424" />
      <path d="M54 153 L72 152 L74 160 L52 161 Z" fill="#111" />
      <rect x="52" y="159" width="22" height="3.5" rx="1" fill="#242424" />
      <path d="M30 155 L44 155" stroke="#33333360" strokeWidth="0.8" />
      <path d="M56 155 L70 155" stroke="#33333360" strokeWidth="0.8" />
    </g>
  )
}
function ShoeHighTop() {
  return (
    <g>
      <rect x="27" y="145" width="19" height="18" rx="2" fill="#1A1A1A" />
      <rect x="54" y="145" width="19" height="18" rx="2" fill="#1A1A1A" />
      {/* Ankle strap */}
      <path d="M27 151 L46 151 L46 155 L27 155 Z" fill="#222" />
      <path d="M54 151 L73 151 L73 155 L54 155 Z" fill="#222" />
      {/* Lace loops */}
      <path d="M30 148 L44 148" stroke="#333" strokeWidth="0.8" strokeDasharray="2 1.5" />
      <path d="M56 148 L70 148" stroke="#333" strokeWidth="0.8" strokeDasharray="2 1.5" />
      {/* Sole */}
      <path d="M25 161 L46 160 L48 163 L25 164 Z" fill="#222" />
      <path d="M52 161 L73 160 L75 163 L52 164 Z" fill="#222" />
    </g>
  )
}
function ShoeBoots() {
  return (
    <g>
      <rect x="27" y="138" width="19" height="25" rx="2" fill="#1A0A00" />
      <rect x="54" y="138" width="19" height="25" rx="2" fill="#1A0A00" />
      {/* Boot stitching */}
      <path d="M29 145 L44 145" stroke="#2A1400" strokeWidth="0.8" strokeDasharray="2 1.5" />
      <path d="M56 145 L71 145" stroke="#2A1400" strokeWidth="0.8" strokeDasharray="2 1.5" />
      <path d="M29 150 L44 150" stroke="#2A1400" strokeWidth="0.8" strokeDasharray="2 1.5" />
      <path d="M56 150 L71 150" stroke="#2A1400" strokeWidth="0.8" strokeDasharray="2 1.5" />
      {/* Sole */}
      <path d="M25 161 L46 160 L48 163 L25 164 Z" fill="#111" />
      <path d="M52 161 L73 160 L75 163 L52 164 Z" fill="#111" />
      {/* Leather shine */}
      <path d="M29 140 L32 148" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M56 140 L59 148" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  )
}
function ShoeLowTop() {
  return (
    <g>
      <path d="M29 153 L46 152 L47 160 L27 161 Z" fill="#E8E8E8" />
      <rect x="27" y="159" width="20" height="3.5" rx="1" fill="#C0C0C0" />
      <path d="M55 153 L72 152 L73 160 L53 161 Z" fill="#E8E8E8" />
      <rect x="53" y="159" width="20" height="3.5" rx="1" fill="#C0C0C0" />
      {/* Laces */}
      <path d="M32 154 L44 154" stroke="#AAA" strokeWidth="0.9" strokeDasharray="2 1.5" />
      <path d="M58 154 L70 154" stroke="#AAA" strokeWidth="0.9" strokeDasharray="2 1.5" />
      {/* Logo */}
      <ellipse cx="38" cy="156" rx="3" ry="1.5" fill="#C0C0C0" opacity="0.5" />
      <ellipse cx="64" cy="156" rx="3" ry="1.5" fill="#C0C0C0" opacity="0.5" />
    </g>
  )
}

function renderShoes(id?: string) {
  switch (id) {
    case 'shoes_hightop': return <ShoeHighTop />
    case 'shoes_boots':   return <ShoeBoots />
    case 'shoes_lowtop':  return <ShoeLowTop />
    default:              return <ShoeSneaker />
  }
}

// ─── Accessories ──────────────────────────────────────────────────────────────
function AccGlasses() {
  return (
    <g>
      <line x1="28" y1="27" x2="32" y2="27" stroke="#60A5FA" strokeWidth="1.5" />
      <line x1="68" y1="27" x2="72" y2="27" stroke="#60A5FA" strokeWidth="1.5" />
      <rect x="32" y="22" width="14" height="10" rx="5" fill="none" stroke="#60A5FA" strokeWidth="1.5" />
      <rect x="32" y="22" width="14" height="10" rx="5" fill="#3B82F6" opacity="0.14" />
      <line x1="46" y1="27" x2="54" y2="27" stroke="#60A5FA" strokeWidth="1.5" />
      <rect x="54" y="22" width="14" height="10" rx="5" fill="none" stroke="#60A5FA" strokeWidth="1.5" />
      <rect x="54" y="22" width="14" height="10" rx="5" fill="#3B82F6" opacity="0.14" />
      <path d="M34 24 L37 23" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" />
      <path d="M56 24 L59 23" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" />
    </g>
  )
}
function AccCrown() {
  return (
    <g>
      <path d="M32 21 L37 4 L50 15 L63 4 L68 21 Z" fill="#FFB800" />
      <rect x="32" y="20" width="36" height="7" rx="2" fill="#E09800" />
      <rect x="32" y="20" width="36" height="2.5" rx="1" fill="#FFD000" opacity="0.6" />
      <circle cx="37" cy="12" r="3.5" fill="#F87171" />
      <circle cx="50" cy="8"  r="4"   fill="#60A5FA" />
      <circle cx="63" cy="12" r="3.5" fill="#A78BFA" />
      <circle cx="35.8" cy="10.8" r="1.2" fill="rgba(255,255,255,0.6)" />
      <circle cx="48.8" cy="6.8"  r="1.4" fill="rgba(255,255,255,0.6)" />
      <circle cx="61.8" cy="10.8" r="1.2" fill="rgba(255,255,255,0.6)" />
    </g>
  )
}
function AccChain() {
  return (
    <g>
      {/* Chain around neck */}
      <path d="M40 50 Q50 58 60 50" stroke="#FFB800" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M41 51 Q50 59 59 51" stroke="#FFB800" strokeWidth="0.6" fill="none" strokeLinecap="round" opacity="0.4" />
      {/* Chain links */}
      <circle cx="50" cy="58" r="2.5" fill="#FFB800" />
      <circle cx="50" cy="58" r="1.5" fill="#E09800" />
      {/* Pendant */}
      <path d="M50 60 L50 70" stroke="#FFB800" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="47" y="68" width="6" height="6" rx="1.5" fill="#FFB800" />
      <rect x="48" y="69" width="4" height="4" rx="1" fill="#E09800" />
      {/* Cross links */}
      <path d="M43 53 L45 55 M47 51 L49 53 M51 51 L53 53 M55 53 L57 55" stroke="#FFB800" strokeWidth="0.7" fill="none" strokeLinecap="round" opacity="0.5" />
    </g>
  )
}
function AccWatch() {
  return (
    <g>
      {/* Watch on left wrist */}
      <rect x="10" y="87" width="12" height="9" rx="2" fill="#FFB800" />
      <rect x="11" y="88" width="10" height="7" rx="1.5" fill="#0A0A1A" />
      {/* Watch face */}
      <circle cx="16" cy="91.5" r="3" fill="#111" />
      <line x1="16" y1="89.5" x2="16" y2="91.5" stroke="#FFB800" strokeWidth="0.7" strokeLinecap="round" />
      <line x1="16" y1="91.5" x2="18" y2="91.5" stroke="#FFB800" strokeWidth="0.7" strokeLinecap="round" />
      {/* Strap */}
      <rect x="11" y="84" width="10" height="4" rx="1" fill="#1A1A1A" />
      <rect x="11" y="95" width="10" height="4" rx="1" fill="#1A1A1A" />
    </g>
  )
}
function AccEarring() {
  return (
    <g>
      {/* Left earring */}
      <circle cx="29" cy="26" r="2" fill="none" stroke="#FFB800" strokeWidth="1.2" />
      {/* Right earring */}
      <circle cx="71" cy="26" r="2" fill="none" stroke="#FFB800" strokeWidth="1.2" />
      {/* Shine */}
      <circle cx="28.5" cy="25.5" r="0.6" fill="rgba(255,255,255,0.5)" />
      <circle cx="70.5" cy="25.5" r="0.6" fill="rgba(255,255,255,0.5)" />
    </g>
  )
}

function renderAccessory(id?: string) {
  switch (id) {
    case 'acc_glasses': return <AccGlasses />
    case 'acc_crown':   return <AccCrown />
    case 'acc_chain':   return <AccChain />
    case 'acc_watch':   return <AccWatch />
    case 'acc_earring': return <AccEarring />
    default:            return null
  }
}

// ─── Streak Flames ────────────────────────────────────────────────────────────
export function StreakFlame({ streak, size = 24 }: { streak: number; size?: number }) {
  if (streak < 3) return null
  const small  = streak >= 3
  const medium = streak >= 5
  const large  = streak >= 7

  return (
    <svg
      viewBox="0 0 24 30"
      width={size}
      height={size * 1.25}
      style={{ filter: `drop-shadow(0 0 ${large ? 8 : medium ? 5 : 3}px #F59E0B88)` }}
    >
      <defs>
        <linearGradient id="flame_grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%"   stopColor="#EF4444" />
          <stop offset="50%"  stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#FEF08A" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      {/* Main flame */}
      <path d="M12 2 Q18 8 17 15 Q19 12 20 16 Q22 22 12 28 Q2 22 4 16 Q5 12 7 15 Q6 8 12 2 Z"
        fill="url(#flame_grad)" opacity="0.9" />
      {/* Inner flame */}
      <path d="M12 8 Q15 12 14 17 Q15 14 17 17 Q18 20 12 24 Q6 20 7 17 Q9 14 10 17 Q9 12 12 8 Z"
        fill="#FEF08A" opacity={large ? 0.8 : 0.5} />
      {/* Spark dots for large */}
      {large && (
        <>
          <circle cx="7"  cy="8"  r="1" fill="#FEF08A" opacity="0.7" />
          <circle cx="17" cy="6"  r="1" fill="#FEF08A" opacity="0.7" />
          <circle cx="19" cy="12" r="0.7" fill="#F59E0B" opacity="0.6" />
        </>
      )}
    </svg>
  )
}

// ─── Main AvatarDisplay Component ────────────────────────────────────────────
const ARCHETYPE_COLORS: Record<string, string> = {
  closer:    '#FFB800',
  duelist:   '#f87171',
  architect: '#60a5fa',
  comeback:  '#fb923c',
  founder:   '#FFB800',
  icon:      '#a78bfa',
}

interface Props {
  config?:      AvatarConfig | null
  archetype?:   string
  size?:        number
  initials?:    string
  showFullBody?: boolean
  streak?:      number
}

export default function AvatarDisplay({
  config,
  archetype = 'founder',
  size = 90,
  initials = 'U',
  showFullBody = false,
  streak = 0,
}: Props) {
  // Resolve slots from config (support legacy field names)
  const skinId  = config?.skin_tone  || config?.body  || 'skin_medium'
  const hairId  = config?.hair       || 'hair_short_textured'
  const hwId    = config?.headwear   || null
  const topId   = config?.top        || config?.outfit || 'top_tshirt'
  const botId   = config?.bottom     || 'bottom_slim'
  const shoeId  = config?.shoes      || 'shoes_sneaker'
  const accId   = config?.accessory  || 'acc_none'
  const bgId    = config?.background || 'bg_dark'

  const skin   = getSkin(skinId)
  const accent = ARCHETYPE_COLORS[archetype] || '#FFB800'

  const viewBox   = showFullBody ? '0 0 100 165' : '15 3 70 70'
  const svgW      = showFullBody ? size     : size * 0.9
  const svgH      = showFullBody ? size * 1.65 : size * 0.9

  const containerStyle: React.CSSProperties = showFullBody
    ? {
        width:      size,
        height:     size * 1.65,
        borderRadius: 20,
        background: 'linear-gradient(180deg, #0D0D18 0%, #060606 100%)',
        boxShadow:  `0 0 0 1.5px ${accent}44, 0 0 30px ${accent}22`,
        overflow:   'hidden',
        display:    'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        position:   'relative',
      }
    : {
        width:      size,
        height:     size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 40% 35%, ${accent}18, #0D0D18 70%)`,
        boxShadow:  `0 0 0 2px ${accent}, 0 0 22px ${accent}44`,
        overflow:   'hidden',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position:   'relative',
      }

  return (
    <div style={containerStyle}>
      <svg viewBox={viewBox} width={svgW} height={svgH} style={{ display:'block', overflow:'visible' }}>
        <defs>
          <linearGradient id="bg_dark_grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#0D0D18" />
            <stop offset="100%" stopColor="#060606" />
          </linearGradient>
          <radialGradient id="ambient" cx="50%" cy="35%" r="55%">
            <stop offset="0%"   stopColor={accent} stopOpacity="0.10" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background */}
        {bgId === 'bg_gold_prestige' ? <BgGold /> :
         bgId === 'bg_smoke'         ? <BgSmoke /> :
                                       <BgDark />}
        <rect x="0" y="0" width="100" height="165" fill="url(#ambient)" />

        {/* ── LAYER ORDER (bottom → top) ── */}
        {/* 1. Bottom */}
        {renderBottom(botId)}
        {/* 2. Shoes */}
        {renderShoes(shoeId)}
        {/* 3. Top */}
        {renderTop(topId)}
        {/* 4. Skin (head, neck, hands – over top so collar shows) */}
        <SkinLayer skin={skin.skin} eye={skin.eye} lip={skin.lip} />
        {/* 5. Hair (or Headwear replaces it visually) */}
        {!hwId && renderHair(hairId)}
        {/* 6. Headwear (over hair) */}
        {renderHeadwear(hwId)}
        {/* 7. Accessory */}
        {renderAccessory(accId)}
      </svg>

      {/* Streak flame overlay */}
      {streak >= 3 && (
        <div style={{ position:'absolute', bottom: showFullBody ? -2 : -4, right: showFullBody ? 4 : -4, pointerEvents:'none' }}>
          <StreakFlame streak={streak} size={showFullBody ? 28 : 20} />
        </div>
      )}

      {/* Ground shadow */}
      {showFullBody && (
        <div style={{
          position: 'absolute', bottom: 0, left:'15%', right:'15%', height: 6,
          background: `radial-gradient(ellipse, ${accent}30 0%, transparent 70%)`,
          borderRadius: '50%',
        }} />
      )}
    </div>
  )
}

// ─── Item Icon (for grids in avatar editor / shop) ────────────────────────────
export function AvatarItemIcon({
  itemId, slot, size = 56, rarity = 'common',
}: {
  itemId: string; slot: string; size?: number; rarity?: string
}) {
  const rc = RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] || RARITY_COLORS.common
  const skin = getSkin('skin_medium')

  const iconContent = () => {
    if (slot === 'skin_tone') {
      const s = getSkin(itemId)
      return (
        <svg viewBox="28 4 44 44" width={size} height={size}>
          <circle cx="50" cy="24" r="17" fill={s.skin} />
          <ellipse cx="43" cy="24" rx="2.2" ry="2.5" fill={s.eye} />
          <ellipse cx="57" cy="24" rx="2.2" ry="2.5" fill={s.eye} />
          <circle cx="44" cy="23" r="0.8" fill="rgba(255,255,255,0.6)" />
          <circle cx="58" cy="23" r="0.8" fill="rgba(255,255,255,0.6)" />
        </svg>
      )
    }
    if (slot === 'hair') {
      return (
        <svg viewBox="28 -4 44 50" width={size} height={size}>
          <circle cx="50" cy="24" r="17" fill={skin.skin} opacity="0.3" />
          {renderHair(itemId)}
        </svg>
      )
    }
    if (slot === 'headwear') {
      return (
        <svg viewBox="15 0 70 45" width={size} height={size}>
          <circle cx="50" cy="24" r="17" fill={skin.skin} opacity="0.25" />
          {renderHeadwear(itemId)}
        </svg>
      )
    }
    if (slot === 'top' || slot === 'outfit') {
      return (
        <svg viewBox="10 44 80 70" width={size} height={size}>
          {renderTop(itemId)}
        </svg>
      )
    }
    if (slot === 'bottom') {
      return (
        <svg viewBox="28 104 44 55" width={size} height={size}>
          {renderBottom(itemId)}
        </svg>
      )
    }
    if (slot === 'shoes') {
      return (
        <svg viewBox="20 148 60 20" width={size} height={size * 0.4}>
          {renderShoes(itemId)}
        </svg>
      )
    }
    if (slot === 'accessory') {
      if (itemId === 'acc_none') return (
        <svg viewBox="28 4 44 44" width={size} height={size}>
          <circle cx="50" cy="24" r="17" fill={skin.skin} opacity="0.2" />
          <text x="50" y="28" textAnchor="middle" fontSize="16" fill="rgba(255,255,255,0.2)">–</text>
        </svg>
      )
      return (
        <svg viewBox="24 0 52 50" width={size} height={size}>
          <circle cx="50" cy="24" r="17" fill={skin.skin} opacity="0.2" />
          {renderAccessory(itemId)}
        </svg>
      )
    }
    if (slot === 'background') {
      return (
        <svg viewBox="0 0 100 100" width={size} height={size} style={{ borderRadius: 8 }}>
          {itemId === 'bg_gold_prestige' ? (
            <>
              <rect x="0" y="0" width="100" height="100" fill="#0D0A00" />
              <ellipse cx="50" cy="50" rx="48" ry="48" fill="none" stroke="#FFB800" strokeWidth="3" opacity="0.5" />
            </>
          ) : itemId === 'bg_smoke' ? (
            <>
              <rect x="0" y="0" width="100" height="100" fill="#0A0A0F" />
              <ellipse cx="30" cy="80" rx="35" ry="25" fill="#1A1A2A" opacity="0.8" />
              <ellipse cx="70" cy="70" rx="30" ry="20" fill="#1A1A2A" opacity="0.6" />
            </>
          ) : (
            <>
              <rect x="0" y="0" width="100" height="100" fill="#0D0D18" />
              <ellipse cx="50" cy="50" rx="40" ry="40" fill="none" stroke="#333" strokeWidth="0.5" opacity="0.4" />
            </>
          )}
        </svg>
      )
    }
    return <svg viewBox="0 0 60 60" width={size} height={size} />
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', filter:`drop-shadow(0 0 6px ${rc}55)` }}>
      {iconContent()}
    </div>
  )
}
