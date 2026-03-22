-- =============================================
-- DEALBUDDY V2 MIGRATION
-- Run this in Supabase SQL Editor AFTER initial schema
-- =============================================

-- ─── 1. UPDATE PROFILES ─────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS claimed_bp_rewards JSONB DEFAULT '[]';

-- ─── 2. UPDATE BETS TABLE ────────────────────
-- Add new status values and columns for double-confirmation flow
ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_status_check;
ALTER TABLE bets ADD CONSTRAINT bets_status_check
  CHECK (status IN ('open','pending','active','pending_confirmation','disputed','completed','cancelled','frozen'));

ALTER TABLE bets
  ADD COLUMN IF NOT EXISTS proposed_winner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winner_proposed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- ─── 3. DEAL ACTIONS (audit log) ─────────────
CREATE TABLE IF NOT EXISTS deal_actions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  deal_id UUID REFERENCES bets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL
    CHECK (action IN ('create','accept','decline','propose_winner','confirm_winner','dispute','resolve','cancel')),
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deal_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deal actions participant read" ON deal_actions
  FOR SELECT USING (
    auth.uid() = actor_id OR
    auth.uid() IN (
      SELECT creator_id FROM bets WHERE id = deal_id
      UNION
      SELECT opponent_id FROM bets WHERE id = deal_id
    )
  );
CREATE POLICY "Auth users insert deal actions" ON deal_actions
  FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- ─── 4. FOLLOWS TABLE ────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows: read own" ON follows
  FOR SELECT USING (auth.uid() = follower_id OR auth.uid() = following_id);
CREATE POLICY "Follows: insert own" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Follows: update target" ON follows
  FOR UPDATE USING (auth.uid() = follower_id OR auth.uid() = following_id);
CREATE POLICY "Follows: delete own" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ─── 5. WALLET LEDGER ────────────────────────
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('win_reward','participation_reward','purchase_stripe','battlepass_reward','equip_purchase','admin','refund','level_up')),
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wallet ledger owner read" ON wallet_ledger
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Wallet ledger service insert" ON wallet_ledger
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── 6. STRIPE TRANSACTIONS ──────────────────
CREATE TABLE IF NOT EXISTS stripe_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','completed','failed','refunded')),
  product_type TEXT NOT NULL
    CHECK (product_type IN ('coin_pack_small','coin_pack_large','premium_pass')),
  amount_cents INTEGER NOT NULL,
  coins_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE stripe_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stripe transactions owner read" ON stripe_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- ─── 7. USER BATTLEPASS TABLE ────────────────
CREATE TABLE IF NOT EXISTS user_battlepass (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  season_id INTEGER REFERENCES seasons(id),
  season_xp INTEGER DEFAULT 0,
  current_tier INTEGER DEFAULT 0,
  premium_unlocked BOOLEAN DEFAULT FALSE,
  claimed_rewards JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, season_id)
);

ALTER TABLE user_battlepass ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User battlepass owner" ON user_battlepass
  FOR ALL USING (auth.uid() = user_id);

-- Auto-create battlepass record for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_battlepass()
RETURNS TRIGGER AS $$
DECLARE
  active_season_id INTEGER;
BEGIN
  SELECT id INTO active_season_id FROM seasons WHERE is_active = true LIMIT 1;
  IF active_season_id IS NOT NULL THEN
    INSERT INTO user_battlepass (user_id, season_id)
    VALUES (NEW.id, active_season_id)
    ON CONFLICT (user_id, season_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_profile_created_battlepass
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_battlepass();

-- ─── 8. NOTIFICATIONS: add action_url column ─
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_url TEXT;

-- ─── 9. UPDATE OLD LEVEL FORMULA ─────────────
-- New formula: xp_required(level) = 250 * (level^1.35)
-- Keep the trigger but update the calculation
CREATE OR REPLACE FUNCTION public.check_level_up()
RETURNS TRIGGER AS $$
DECLARE
  new_level INTEGER := 1;
  xp_needed INTEGER;
BEGIN
  -- Calculate new level using progression curve
  LOOP
    xp_needed := FLOOR(250 * POWER(new_level, 1.35));
    IF NEW.xp >= xp_needed THEN
      new_level := new_level + 1;
    ELSE
      EXIT;
    END IF;
    IF new_level > 100 THEN EXIT; END IF;
  END LOOP;
  new_level := new_level - 1;
  IF new_level < 1 THEN new_level := 1; END IF;

  IF new_level > NEW.level THEN
    UPDATE profiles
    SET level = new_level,
        coins = coins + (new_level - NEW.level) * 10
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 10. SEED: Add more cosmetics for BP ─────
INSERT INTO cosmetics (id, name, description, item_type, rarity, coin_price, is_purchasable) VALUES
  ('rare_frame_v1',    'Iron Curtain',    'Seltener Schutzrahmen',          'frame',  'rare',      100,  true),
  ('rare_frame_v2',    'Shadow Edge',     'Dunkler Seltener Rahmen',        'frame',  'rare',      100,  true),
  ('epic_frame_v1',    'Eclipse',         'Epischer Mondfinsternis-Rahmen', 'frame',  'epic',      250,  true),
  ('rare_badge_v1',    'Contender',       'Season Contender',               'badge',  'rare',      0,    false),
  ('epic_badge_v1',    'Rival King',      'Legendary Rival',                'badge',  'epic',      0,    false),
  ('rare_card_v1',     'Obsidian Card',   'Seltene schwarze Card-Skin',     'card_skin', 'rare',   100,  true),
  ('epic_card_v1',     'Gold Rush',       'Epische Gold Card-Skin',         'card_skin', 'epic',   250,  true),
  ('title_contender',  'Season Contender', 'Titel: Season Contender',       'title',  'rare',      0,    false),
  ('title_rival',      'Founder Rival',   'Titel: Founder Rival',           'title',  'epic',      0,    false)
ON CONFLICT (id) DO NOTHING;

-- ─── 11. UPDATE BATTLE PASS REWARDS (Full 30 tiers) ─
-- First: expand the reward_type check constraint to allow card_skin
ALTER TABLE battle_pass_rewards DROP CONSTRAINT IF EXISTS battle_pass_rewards_reward_type_check;
ALTER TABLE battle_pass_rewards ADD CONSTRAINT battle_pass_rewards_reward_type_check
  CHECK (reward_type IN ('coins', 'xp', 'frame', 'badge', 'title', 'card_skin', 'cosmetic', 'avatar_item'));

-- Clear old rewards and insert complete set
DELETE FROM battle_pass_rewards WHERE season_id = 1;

INSERT INTO battle_pass_rewards (season_id, level, track, reward_type, reward_value, reward_amount) VALUES
-- FREE TRACK
  (1, 1,  'free', 'coins',       null,             100),
  (1, 2,  'free', 'frame',       'stone_cold',     0),
  (1, 3,  'free', 'coins',       null,             150),
  (1, 4,  'free', 'badge',       'rare_badge_v1',  0),
  (1, 5,  'free', 'frame',       'rare_frame_v1',  0),    -- Milestone 1
  (1, 6,  'free', 'coins',       null,             200),
  (1, 7,  'free', 'card_skin',   'rare_card_v1',   0),
  (1, 8,  'free', 'coins',       null,             250),
  (1, 9,  'free', 'badge',       'the_architect',  0),
  (1, 10, 'free', 'coins',       null,             300),   -- Milestone 2
  (1, 11, 'free', 'frame',       'rare_frame_v2',  0),
  (1, 12, 'free', 'coins',       null,             350),
  (1, 13, 'free', 'coins',       null,             400),
  (1, 14, 'free', 'coins',       null,             400),
  (1, 15, 'free', 'badge',       'epic_badge_v1',  0),    -- Milestone 3
  (1, 16, 'free', 'coins',       null,             400),
  (1, 17, 'free', 'card_skin',   'epic_card_v1',   0),
  (1, 18, 'free', 'coins',       null,             450),
  (1, 19, 'free', 'title',       'title_contender',0),
  (1, 20, 'free', 'coins',       null,             500),   -- Milestone 4
  (1, 21, 'free', 'frame',       'blue_steel',     0),
  (1, 22, 'free', 'coins',       null,             500),
  (1, 23, 'free', 'card_skin',   'epic_card_v1',   0),
  (1, 24, 'free', 'coins',       null,             600),
  (1, 25, 'free', 'frame',       'epic_frame_v1',  0),    -- Milestone 5
  (1, 26, 'free', 'coins',       null,             600),
  (1, 27, 'free', 'title',       'title_rival',    0),
  (1, 28, 'free', 'coins',       null,             700),
  (1, 29, 'free', 'frame',       'rare_frame_v1',  0),
  (1, 30, 'free', 'badge',       'untouchable',    0),    -- Legendary Founder Emblem
-- PREMIUM TRACK
  (1, 1,  'premium', 'frame',    'founder_carbon', 0),
  (1, 5,  'premium', 'frame',    'rare_frame_v2',  0),
  (1, 10, 'premium', 'badge',    'epic_badge_v1',  0),
  (1, 15, 'premium', 'coins',    null,             500),
  (1, 20, 'premium', 'frame',    'midas_touch',    0),
  (1, 25, 'premium', 'card_skin','epic_card_v1',   0),
  (1, 30, 'premium', 'frame',    'samurai_blade',  0)
ON CONFLICT DO NOTHING;

-- ─── 12. DISABLE OLD XP TRIGGER ──────────────
-- The old trigger awards XP on status='completed'
-- We keep it for backwards compat but the Edge Function
-- will be the primary XP source going forward.
-- To fully disable: DROP TRIGGER on_deal_completed ON bets;
-- For now keep it and use it for deals that go to 'completed' directly.

-- ─── DONE ─────────────────────────────────────
-- Run this migration, then deploy Edge Functions.
