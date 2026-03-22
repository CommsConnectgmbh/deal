import * as path from 'path';

export const CONFIG = {
  // FULL-CARD: DALL-E 3 generates the complete card (frame + character + background)
  dalle: {
    model: 'dall-e-3' as const,
    size: '1024x1792' as const,    // Portrait format (tall card, ~2:3 ratio)
    quality: 'standard' as const,   // $0.08 per image at 1024x1792
    style: 'vivid' as const,
  },
  canvasWidth: 1024,
  canvasHeight: 1792,

  // Rate Limits
  rateLimit: {
    pauseBetweenRequests: 5000,      // 5s between requests
    pauseBetweenBatches: 30000,      // 30s between batches
    batchSize: 5,                    // 5 images per batch
  },

  // Cost per image (DALL-E 3 standard 1024x1792 = $0.08)
  costPerImage: 0.08,

  // Supabase Storage
  storage: {
    bucket: 'card-images',
    maxRetries: 3,
  },

  // Generation priority order
  generationOrder: [
    'founder',
    'legendary',
    'event',
    'epic',
    'rare',
    'common',
  ] as string[],

  // Frame types (for reference — no longer used for compositing)
  frameTypes: [
    'bronze', 'silver', 'gold',
    'emerald', 'sapphire', 'ruby', 'amethyst', 'topaz',
    'legend', 'icon', 'obsidian',
    'founder', 'hero',
    'futties', 'neon', 'celestial', 'player_of_the_week',
  ] as string[],

  // Local image cache
  localImageDir: path.resolve(__dirname, './generated-images'),
};
