-- ============================================================
-- DealBuddy V3 Migration
-- Run this in Supabase SQL Editor (Project > SQL Editor > New Query)
-- ============================================================

-- 1. Alter profiles: add new cosmetic slots
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_title text,
  ADD COLUMN IF NOT EXISTS active_card text,
  ADD COLUMN IF NOT EXISTS active_victory_animation text;

-- 2. avatar_items catalog
CREATE TABLE IF NOT EXISTS avatar_items (
  id text PRIMARY KEY,
  slot text NOT NULL CHECK (slot IN ('body','hair','outfit','accessory')),
  name text NOT NULL,
  description text,
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  price_coins int NOT NULL DEFAULT 0,
  icon_emoji text NOT NULL DEFAULT '🧑',
  is_default bool NOT NULL DEFAULT false,
  unlock_condition text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE avatar_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avatar_items_public_read" ON avatar_items FOR SELECT TO authenticated USING (true);

-- 3. user_avatar_inventory
CREATE TABLE IF NOT EXISTS user_avatar_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES avatar_items(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);
ALTER TABLE user_avatar_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uai_select_own" ON user_avatar_inventory FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "uai_insert_own" ON user_avatar_inventory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uai_delete_own" ON user_avatar_inventory FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. avatar_config (active equipped avatar per user)
CREATE TABLE IF NOT EXISTS avatar_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  body text DEFAULT 'body_default',
  hair text DEFAULT 'hair_default',
  outfit text DEFAULT 'outfit_default',
  accessory text DEFAULT 'acc_none',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE avatar_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_select_own" ON avatar_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ac_insert_own" ON avatar_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ac_update_own" ON avatar_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);
-- Public can see other people's avatar configs (for profile display)
CREATE POLICY "ac_select_public" ON avatar_config FOR SELECT TO authenticated USING (true);

-- 5. style_packs
CREATE TABLE IF NOT EXISTS style_packs (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_coins int NOT NULL DEFAULT 0,
  stripe_product_id text,
  icon_emoji text NOT NULL DEFAULT '🎁',
  rarity text NOT NULL DEFAULT 'epic' CHECK (rarity IN ('common','rare','epic','legendary')),
  active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE style_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "style_packs_public_read" ON style_packs FOR SELECT TO authenticated USING (true);

-- 6. style_pack_items
CREATE TABLE IF NOT EXISTS style_pack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id text NOT NULL REFERENCES style_packs(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('cosmetic','avatar_item')),
  item_id text NOT NULL
);
ALTER TABLE style_pack_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spi_public_read" ON style_pack_items FOR SELECT TO authenticated USING (true);

-- 7. reward_boxes catalog
CREATE TABLE IF NOT EXISTS reward_boxes (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  price_coins int NOT NULL DEFAULT 50,
  price_cents int,
  icon_emoji text NOT NULL DEFAULT '📦',
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reward_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reward_boxes_public_read" ON reward_boxes FOR SELECT TO authenticated USING (true);

-- 8. reward_box_loot_table
CREATE TABLE IF NOT EXISTS reward_box_loot_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id text NOT NULL REFERENCES reward_boxes(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN ('coins','cosmetic','avatar_item','battle_pass_xp')),
  reward_value text NOT NULL,
  weight int NOT NULL DEFAULT 100,
  min_qty int NOT NULL DEFAULT 1,
  max_qty int NOT NULL DEFAULT 1
);
ALTER TABLE reward_box_loot_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rbl_public_read" ON reward_box_loot_table FOR SELECT TO authenticated USING (true);

-- 9. reward_box_history
CREATE TABLE IF NOT EXISTS reward_box_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  box_id text NOT NULL,
  reward_type text NOT NULL,
  reward_value text NOT NULL,
  qty int NOT NULL DEFAULT 1,
  opened_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reward_box_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rbh_select_own" ON reward_box_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rbh_insert_own" ON reward_box_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Avatar Items Catalog
INSERT INTO avatar_items (id, slot, name, description, rarity, price_coins, icon_emoji, is_default) VALUES
  -- Body
  ('body_default',  'body', 'Classic',      'Standard Body',              'common',    0,    '🧑',  true),
  ('body_warrior',  'body', 'Warrior',       'Battle-hardened Fighter',    'rare',      100,  '🧑‍⚔️', false),
  ('body_shadow',   'body', 'Shadow',        'Mysterious Dark Silhouette', 'epic',      250,  '🥷',  false),
  -- Hair
  ('hair_default',  'hair', 'Classic Cut',   'Clean Standard Hair',        'common',    0,    '💈',  true),
  ('hair_spiky',    'hair', 'Spiky',         'Sharp Spiked Style',         'rare',      100,  '⚡',  false),
  ('hair_flow',     'hair', 'Flow',          'Smooth Flowing Locks',       'epic',      250,  '🌊',  false),
  -- Outfit
  ('outfit_default',  'outfit', 'Street',    'Casual Street Style',        'common',    0,    '👕',  true),
  ('outfit_founder',  'outfit', 'Founder',   'Season 1 Founder Outfit',    'legendary', 0,    '👔',  false),
  ('outfit_champion', 'outfit', 'Champion',  'Champion Winner''s Jacket',  'epic',      250,  '🏆',  false),
  -- Accessory
  ('acc_none',      'accessory', 'None',     'No Accessory',               'common',    0,    '·',   true),
  ('acc_glasses',   'accessory', 'Shades',   'Cool Dark Shades',           'rare',      100,  '🕶️',  false),
  ('acc_crown',     'accessory', 'Crown',    'Royal Gold Crown',           'legendary', 500,  '👑',  false)
ON CONFLICT (id) DO NOTHING;

-- Reward Boxes
INSERT INTO reward_boxes (id, name, slug, price_coins, price_cents, icon_emoji, rarity, description) VALUES
  ('standard_box',  'Standard Box',   'standard_box',  50,  null, '📦', 'common',    'A basic mystery box. Could be anything!'),
  ('rare_box',      'Rare Box',       'rare_box',      150, null, '💎', 'rare',      'Higher chance of rare and epic items.'),
  ('legendary_box', 'Legendary Box',  'legendary_box', 500, 499,  '🔥', 'legendary', 'Guaranteed epic or legendary reward.')
ON CONFLICT (id) DO NOTHING;

-- Loot Table: Standard Box
INSERT INTO reward_box_loot_table (box_id, reward_type, reward_value, weight, min_qty, max_qty) VALUES
  ('standard_box', 'coins',      '25',           400, 25,  25),
  ('standard_box', 'coins',      '50',           250, 50,  50),
  ('standard_box', 'coins',      '100',          100, 100, 100),
  ('standard_box', 'avatar_item','body_warrior',   80,  1,   1),
  ('standard_box', 'avatar_item','hair_spiky',     80,  1,   1),
  ('standard_box', 'avatar_item','acc_glasses',    80,  1,   1),
  ('standard_box', 'cosmetic',   'blue_steel',     10,  1,   1)
ON CONFLICT DO NOTHING;

-- Loot Table: Rare Box
INSERT INTO reward_box_loot_table (box_id, reward_type, reward_value, weight, min_qty, max_qty) VALUES
  ('rare_box', 'coins',      '100',           300, 100, 100),
  ('rare_box', 'coins',      '200',           150, 200, 200),
  ('rare_box', 'avatar_item','body_shadow',   200,   1,   1),
  ('rare_box', 'avatar_item','hair_flow',     200,   1,   1),
  ('rare_box', 'avatar_item','outfit_champion',100,  1,   1),
  ('rare_box', 'cosmetic',   'samurai_blade',  30,   1,   1),
  ('rare_box', 'cosmetic',   'midas_touch',    20,   1,   1)
ON CONFLICT DO NOTHING;

-- Loot Table: Legendary Box
INSERT INTO reward_box_loot_table (box_id, reward_type, reward_value, weight, min_qty, max_qty) VALUES
  ('legendary_box', 'coins',      '500',            200, 500, 500),
  ('legendary_box', 'avatar_item','acc_crown',      150,   1,   1),
  ('legendary_box', 'avatar_item','outfit_founder', 100,   1,   1),
  ('legendary_box', 'avatar_item','body_shadow',    200,   1,   1),
  ('legendary_box', 'cosmetic',   'midas_touch',    200,   1,   1),
  ('legendary_box', 'battle_pass_xp', '500',        150, 500, 500)
ON CONFLICT DO NOTHING;

-- Style Packs
INSERT INTO style_packs (id, name, description, price_coins, icon_emoji, rarity) VALUES
  ('founder_pack', 'Founder Pack',  'Exclusive Season 1 Founder bundle', 500,  '👑', 'legendary'),
  ('elite_pack',   'Elite Pack',    'Premium cosmetic collection',        1200, '⚡', 'epic')
ON CONFLICT (id) DO NOTHING;

-- Style Pack Items
INSERT INTO style_pack_items (pack_id, item_type, item_id) VALUES
  ('founder_pack', 'avatar_item', 'outfit_founder'),
  ('founder_pack', 'avatar_item', 'acc_crown'),
  ('founder_pack', 'cosmetic',    'founder_carbon'),
  ('elite_pack',   'avatar_item', 'body_shadow'),
  ('elite_pack',   'avatar_item', 'hair_flow'),
  ('elite_pack',   'cosmetic',    'samurai_blade')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TRIGGER: Auto-grant default avatar items on profile creation
-- ============================================================
CREATE OR REPLACE FUNCTION grant_default_avatar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Insert default avatar items
  INSERT INTO user_avatar_inventory (user_id, item_id)
  SELECT NEW.id, id FROM avatar_items WHERE is_default = true
  ON CONFLICT (user_id, item_id) DO NOTHING;

  -- Create default avatar_config
  INSERT INTO avatar_config (user_id, body, hair, outfit, accessory)
  VALUES (NEW.id, 'body_default', 'hair_default', 'outfit_default', 'acc_none')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_grant_avatar ON profiles;
CREATE TRIGGER on_profile_created_grant_avatar
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION grant_default_avatar();

-- Run for existing profiles (backfill)
INSERT INTO user_avatar_inventory (user_id, item_id)
SELECT p.id, ai.id
FROM profiles p
CROSS JOIN avatar_items ai
WHERE ai.is_default = true
ON CONFLICT (user_id, item_id) DO NOTHING;

INSERT INTO avatar_config (user_id, body, hair, outfit, accessory)
SELECT id, 'body_default', 'hair_default', 'outfit_default', 'acc_none'
FROM profiles
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- Done! Tables created, seed data inserted, trigger installed.
-- ============================================================
