/**
 * Frame configurations with rarity-specific attribute rules.
 */

export interface FrameConfig {
  frame: string;
  rarity: string;
  count: number;
  allowedEffects: string[];
  forceAccessory: boolean; // Legendary/Founder always have an accessory
}

export const FRAME_CONFIGS: FrameConfig[] = [
  // ── COMMON ──
  { frame: 'bronze',  rarity: 'common',    count: 100, allowedEffects: ['none','glow'], forceAccessory: false },
  { frame: 'silver',  rarity: 'common',    count: 100, allowedEffects: ['none','glow'], forceAccessory: false },

  // ── RARE ──
  { frame: 'gold',    rarity: 'rare',      count: 50,  allowedEffects: ['none','glow','particles'], forceAccessory: false },

  // ── EPIC ──
  { frame: 'emerald', rarity: 'epic',      count: 20,  allowedEffects: ['none','glow','particles','lightning','fire','ice'], forceAccessory: false },
  { frame: 'sapphire',rarity: 'epic',      count: 20,  allowedEffects: ['none','glow','particles','lightning','fire','ice'], forceAccessory: false },
  { frame: 'ruby',    rarity: 'epic',      count: 20,  allowedEffects: ['none','glow','particles','lightning','fire','ice'], forceAccessory: false },
  { frame: 'amethyst',rarity: 'epic',      count: 20,  allowedEffects: ['none','glow','particles','lightning','fire','ice'], forceAccessory: false },
  { frame: 'topaz',   rarity: 'epic',      count: 20,  allowedEffects: ['none','glow','particles','lightning','fire','ice'], forceAccessory: false },

  // ── LEGENDARY ──
  { frame: 'legend',  rarity: 'legendary', count: 10,  allowedEffects: ['lightning','fire','ice','rainbow','holographic'], forceAccessory: true },
  { frame: 'icon',    rarity: 'legendary', count: 10,  allowedEffects: ['lightning','fire','ice','rainbow','holographic'], forceAccessory: true },
  { frame: 'obsidian',rarity: 'legendary', count: 5,   allowedEffects: ['lightning','fire','ice','rainbow','holographic'], forceAccessory: true },

  // ── FOUNDER ──
  { frame: 'founder', rarity: 'founder',   count: 10,  allowedEffects: ['glow','rainbow','holographic'], forceAccessory: true },
  { frame: 'hero',    rarity: 'founder',   count: 10,  allowedEffects: ['glow','rainbow','holographic'], forceAccessory: true },

  // ── EVENT ──
  { frame: 'futties',            rarity: 'event', count: 10, allowedEffects: ['glow','particles','rainbow'], forceAccessory: false },
  { frame: 'neon',               rarity: 'event', count: 10, allowedEffects: ['glow','lightning','holographic'], forceAccessory: false },
  { frame: 'celestial',          rarity: 'event', count: 10, allowedEffects: ['particles','ice','holographic'], forceAccessory: false },
  { frame: 'player_of_the_week', rarity: 'event', count: 10, allowedEffects: ['glow','fire','lightning'], forceAccessory: false },
];

// ── Attribute pools ──
export const GENDERS = ['male', 'female'];
export const ORIGINS = ['european', 'african', 'east_asian', 'south_asian', 'latin', 'middle_eastern'];
export const HAIRS = ['short', 'long', 'curly', 'buzz', 'ponytail', 'braided'];
export const STYLES = ['business_suit', 'luxury_blazer', 'streetwear_hoodie', 'tech_founder', 'cyberpunk_jacket', 'fantasy_armor'];
export const ACCESSORIES = ['none', 'glasses', 'gold_chain', 'watch', 'earrings'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface GeneratedAttributes {
  gender: string;
  origin: string;
  hair: string;
  style: string;
  accessory: string;
  effect: string;
}

/**
 * Generate random card attributes respecting rarity rules.
 */
export function generateCardAttributes(config: FrameConfig): GeneratedAttributes {
  const gender = pick(GENDERS);
  const origin = pick(ORIGINS);
  const hair = pick(HAIRS);
  const style = pick(STYLES);

  // Accessory: Legendary/Founder always have one
  let accessory: string;
  if (config.forceAccessory) {
    accessory = pick(ACCESSORIES.filter(a => a !== 'none'));
  } else {
    accessory = pick(ACCESSORIES);
  }

  // Effect: Only from allowed list
  const effect = pick(config.allowedEffects);

  return { gender, origin, hair, style, accessory, effect };
}

/**
 * Build unique card code.
 */
export function buildCardCode(
  frame: string,
  attrs: GeneratedAttributes,
  serialNum: number
): string {
  return `${frame}_${attrs.gender}_${attrs.origin}_${attrs.hair}_${attrs.style}_${attrs.accessory}_${attrs.effect}_${String(serialNum).padStart(4, '0')}`;
}

/**
 * Build serial display text.
 */
export function buildSerialDisplay(
  rarity: string,
  serialNum: number,
  totalCount: number
): string | null {
  if (rarity === 'legendary' || rarity === 'founder') {
    return `#${String(serialNum).padStart(3, '0')} / ${String(totalCount).padStart(3, '0')}`;
  } else if (rarity === 'epic' || rarity === 'event') {
    return `#${String(serialNum).padStart(4, '0')}`;
  }
  return null;
}

/**
 * Total cards across all frame configs.
 */
export function getTotalCardCount(): number {
  return FRAME_CONFIGS.reduce((sum, c) => sum + c.count, 0);
}
