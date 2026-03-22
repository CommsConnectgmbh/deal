/**
 * prompt-builder.ts — FULL-CARD VERSION
 *
 * Builds prompts for DALL-E 3 to generate complete trading cards.
 * Uses the user's proven prompt structure for DealBuddy battle cards.
 */

export interface CardTraits {
  id: string;
  frame_type: string;
  rarity: string;
  gender: string;
  origin: string;
  hair: string;
  style: string;
  accessory: string;
  effect: string;
}

/* ═══════════════════════════════════════════════════════════
   Frame → Rarity Style Description
   ═══════════════════════════════════════════════════════════ */

const RARITY_FRAME_STYLE: Record<string, string> = {
  // ── COMMON ──
  bronze: 'COMMON rarity card. Bronze frame made of brushed bronze metal, subtle glow',
  silver: 'COMMON rarity card. Silver frame made of polished silver metal',

  // ── RARE ──
  gold: 'RARE rarity card. Gold frame made of radiant gold with light particles',

  // ── EPIC ──
  emerald: 'EPIC rarity card. Emerald crystal frame with green magical glow',
  sapphire: 'EPIC rarity card. Sapphire crystal frame with blue energy',
  ruby: 'EPIC rarity card. Ruby gemstone frame with fire aura',
  amethyst: 'EPIC rarity card. Amethyst crystal frame with purple magic energy',
  topaz: 'EPIC rarity card. Topaz crystal frame with golden lightning',

  // ── LEGENDARY ──
  legend: 'LEGENDARY rarity card. Legend frame with radiant golden light beams',
  icon: 'LEGENDARY rarity card. Icon frame with celestial gold and heroic aura',
  obsidian: 'LEGENDARY rarity card. Obsidian frame made of dark volcanic crystal with red energy cracks',

  // ── FOUNDER ──
  founder: 'FOUNDER rarity card. Founder frame with royal gold ornaments and crown motifs',
  hero: 'FOUNDER rarity card. Hero frame with mythic heroic aura and radiant gold flames',

  // ── EVENT ──
  futties: 'EVENT rarity card. Futties frame with vibrant summer neon colors',
  neon: 'EVENT rarity card. Neon frame with glowing cyberpunk lights',
  celestial: 'EVENT rarity card. Celestial frame with galaxy stars and cosmic energy',
  player_of_the_week: 'EVENT rarity card. Player of the week frame with stadium spotlights and championship glow',
};

/* ═══════════════════════════════════════════════════════════
   Effect descriptions (short form for prompt)
   ═══════════════════════════════════════════════════════════ */

const EFFECT_DESC: Record<string, string> = {
  none: 'none',
  glow: 'glow',
  particles: 'particles',
  lightning: 'lightning',
  fire: 'fire',
  ice: 'ice',
  rainbow: 'rainbow',
  holographic: 'holographic',
};

/* ═══════════════════════════════════════════════════════════
   buildCardPrompt — User's proven DealBuddy prompt structure
   ═══════════════════════════════════════════════════════════ */

export function buildCardPrompt(card: CardTraits): string {
  const frameStyle = RARITY_FRAME_STYLE[card.frame_type] || RARITY_FRAME_STYLE.bronze;
  const effect = EFFECT_DESC[card.effect] || 'none';
  const accessory = card.accessory === 'none' ? 'none' : card.accessory.replace('_', ' ');
  const style = card.style.replace(/_/g, ' ');
  const origin = card.origin.replace(/_/g, ' ');

  return `Create a premium collectible digital trading card for a mobile game called DealBuddy.

FORMAT: vertical trading card, aspect ratio 2:3, single card centered, solid black background outside the card, no environment

CARD STRUCTURE: ornate collectible card frame with a large portrait window, metallic fantasy / esports style frame, high-end polished edges and glowing accents, bottom plate engraved with the text "DEALBUDDY"

RARITY FRAME STYLE: ${frameStyle}
Crystal reflections, magical energy flowing through the frame, dramatic lighting, premium collectible look

CHARACTER PORTRAIT: upper body hero portrait inside the card window
gender: ${card.gender}
origin: ${origin}
hair: ${card.hair}
outfit: ${style}
accessories: ${accessory}

EFFECTS: ${effect}

ART STYLE: AAA video game character art, semi realistic stylized illustration, dramatic lighting and high contrast, clean composition designed for trading cards

IMPORTANT: the card frame must be fully visible, the character must stay inside the frame window, solid black outside the card borders, no extra UI, no duplicate cards, only one single trading card

premium esports trading card similar to FIFA Ultimate Team card design`.trim();
}

export function buildPromptWithMetadata(card: CardTraits) {
  return {
    card_id: card.id,
    rarity: card.rarity,
    frame: card.frame_type,
    prompt: buildCardPrompt(card),
    traits: {
      gender: card.gender,
      origin: card.origin,
      hair: card.hair,
      style: card.style,
      accessory: card.accessory,
      effect: card.effect,
    },
  };
}
