-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION V14 — Fix user_unlocked_items CHECK constraint      ║
-- ║  Problem: unlocked_via only allows 6 values, but edge          ║
-- ║  functions use 'prestige', 'pack', 'default', 'founder_grant'  ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Drop old constraint
ALTER TABLE user_unlocked_items DROP CONSTRAINT IF EXISTS user_unlocked_items_unlocked_via_check;

-- Add fixed constraint with ALL values used across codebase
ALTER TABLE user_unlocked_items ADD CONSTRAINT user_unlocked_items_unlocked_via_check
  CHECK (unlocked_via IN (
    -- Original V8 values
    'free',
    'coins',
    'battle_pass',
    'shop',
    'event',
    'achievement',
    -- V11 Store Redesign
    'prestige',
    'pack',
    'default',
    'founder_grant',
    -- Edge functions
    'reward_box',
    'admin'
  ));

-- Backfill: ensure all existing users have bronze frame unlocked
INSERT INTO user_unlocked_items (user_id, item_type, item_code, unlocked_via)
SELECT id, 'frame', 'bronze', 'free' FROM profiles
ON CONFLICT (user_id, item_type, item_code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- DONE — V14 Fix Complete
-- ═══════════════════════════════════════════════════════════════════
