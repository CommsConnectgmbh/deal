-- =============================================
-- DEALBUDDY PWA – COMPLETE DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ───────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,

  -- Prestige System
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 100,           -- Start with 100 Buddy Coins
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  deals_total INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),

  -- Identity
  primary_archetype TEXT DEFAULT 'founder'
    CHECK (primary_archetype IN ('closer','duelist','architect','comeback','founder','icon')),
  archetype_score JSONB DEFAULT '{}',

  -- Cosmetics
  active_frame TEXT DEFAULT 'founder_carbon',
  active_card_skin TEXT DEFAULT 'default',
  active_badge TEXT DEFAULT 'season1_founder',

  -- Battle Pass
  battle_pass_level INTEGER DEFAULT 1,
  battle_pass_premium BOOLEAN DEFAULT FALSE,
  battle_pass_xp INTEGER DEFAULT 0,

  -- Founder status (first 1000 users)
  is_founder BOOLEAN DEFAULT FALSE,
  founder_number INTEGER,

  -- Season
  current_season INTEGER DEFAULT 1,
  season_completed BOOLEAN DEFAULT FALSE,

  -- Reputation (legacy)
  reputation_score DECIMAL(3,1) DEFAULT 5.0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BETS / DEALS ───────────────────────────
CREATE TABLE IF NOT EXISTS bets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,
  stake TEXT,                           -- Free text: "Eine Runde Bier"
  category TEXT DEFAULT 'custom',
  is_public BOOLEAN DEFAULT FALSE,

  status TEXT DEFAULT 'open'
    CHECK (status IN ('open','pending','active','completed','cancelled','frozen')),

  -- Freeze mechanic (conflict resolution)
  frozen_by UUID REFERENCES profiles(id),
  frozen_at TIMESTAMPTZ,
  freeze_reason TEXT,

  -- Legacy amount fields (cents) – optional
  creator_amount INTEGER DEFAULT 0,
  opponent_amount INTEGER DEFAULT 0,
  creator_paid BOOLEAN DEFAULT FALSE,
  opponent_paid BOOLEAN DEFAULT FALSE,

  -- XP awarded
  xp_awarded BOOLEAN DEFAULT FALSE,
  xp_amount INTEGER DEFAULT 0,

  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RIVALRIES ──────────────────────────────
CREATE TABLE IF NOT EXISTS rivalries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rival_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  total_deals INTEGER DEFAULT 0,
  rivalry_intensity INTEGER DEFAULT 0    -- 0-100

    CHECK (rivalry_intensity >= 0 AND rivalry_intensity <= 100),

  -- Badges auto-granted
  is_heated BOOLEAN DEFAULT FALSE,       -- intensity >= 50
  is_legendary BOOLEAN DEFAULT FALSE,    -- intensity >= 80

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, rival_id)
);

-- ─── INVENTORY ──────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL
    CHECK (item_type IN ('frame','card_skin','badge','animation','title')),
  rarity TEXT DEFAULT 'common'
    CHECK (rarity IN ('common','rare','epic','legendary')),
  is_equipped BOOLEAN DEFAULT FALSE,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  season_acquired INTEGER DEFAULT 1,
  UNIQUE(user_id, item_id)
);

-- ─── COSMETICS CATALOG ──────────────────────
CREATE TABLE IF NOT EXISTS cosmetics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL
    CHECK (item_type IN ('frame','card_skin','badge','animation','title')),
  rarity TEXT DEFAULT 'common'
    CHECK (rarity IN ('common','rare','epic','legendary')),
  coin_price INTEGER DEFAULT 0,
  is_purchasable BOOLEAN DEFAULT TRUE,
  is_season_exclusive BOOLEAN DEFAULT FALSE,
  season_available INTEGER,
  unlock_condition TEXT,               -- e.g. 'wins_10', 'level_50'
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SEASONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  theme TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT FALSE,
  exclusive_frame_id TEXT,
  exclusive_badge_id TEXT,
  exclusive_title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BATTLE PASS REWARDS ────────────────────
CREATE TABLE IF NOT EXISTS battle_pass_rewards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  season_id INTEGER REFERENCES seasons(id),
  level INTEGER NOT NULL,              -- 1-30
  track TEXT NOT NULL
    CHECK (track IN ('free','premium')),
  reward_type TEXT NOT NULL
    CHECK (reward_type IN ('coins','frame','badge','animation','title','xp_boost')),
  reward_value TEXT,                   -- item_id or coin amount
  reward_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── XP EVENTS ──────────────────────────────
CREATE TABLE IF NOT EXISTS xp_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  xp_gained INTEGER NOT NULL,
  description TEXT,
  related_bet_id UUID REFERENCES bets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DEBT LEDGER ────────────────────────────
CREATE TABLE IF NOT EXISTS debt_ledger (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bet_id UUID REFERENCES bets(id) ON DELETE CASCADE,
  debtor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  creditor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER DEFAULT 0,
  settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── NOTIFICATIONS ──────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivalries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_pass_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles public read" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Bets
CREATE POLICY "Bets public read" ON bets FOR SELECT USING (true);
CREATE POLICY "Auth users create bets" ON bets FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Participants update bets" ON bets FOR UPDATE
  USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- Rivalries
CREATE POLICY "Rivalries public read" ON rivalries FOR SELECT USING (true);
CREATE POLICY "Users manage own rivalries" ON rivalries FOR ALL USING (auth.uid() = user_id);

-- Inventory
CREATE POLICY "Inventory owner read" ON inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Inventory owner write" ON inventory FOR ALL USING (auth.uid() = user_id);

-- Cosmetics & Seasons & Battle Pass – public read
CREATE POLICY "Cosmetics public read" ON cosmetics FOR SELECT USING (true);
CREATE POLICY "Seasons public read" ON seasons FOR SELECT USING (true);
CREATE POLICY "Battle pass rewards public read" ON battle_pass_rewards FOR SELECT USING (true);

-- XP Events
CREATE POLICY "XP events owner read" ON xp_events FOR SELECT USING (auth.uid() = user_id);

-- Debt Ledger
CREATE POLICY "Debt ledger participant read" ON debt_ledger
  FOR SELECT USING (auth.uid() = debtor_id OR auth.uid() = creditor_id);

-- Notifications
CREATE POLICY "Notifications owner" ON notifications FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  founder_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO founder_count FROM public.profiles;
  INSERT INTO public.profiles (id, username, display_name, is_founder, founder_number, active_frame)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    founder_count < 1000,
    CASE WHEN founder_count < 1000 THEN founder_count + 1 ELSE NULL END,
    CASE WHEN founder_count < 1000 THEN 'founder_carbon' ELSE 'default' END
  );
  -- Give founders the Season 1 badge
  IF founder_count < 1000 THEN
    INSERT INTO public.inventory (user_id, item_id, item_type, rarity, is_equipped)
    VALUES (NEW.id, 'season1_founder', 'badge', 'legendary', true);
    INSERT INTO public.inventory (user_id, item_id, item_type, rarity, is_equipped)
    VALUES (NEW.id, 'founder_carbon', 'frame', 'legendary', true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Award XP when deal is completed
CREATE OR REPLACE FUNCTION public.handle_deal_completed()
RETURNS TRIGGER AS $$
DECLARE
  base_xp INTEGER := 25;
  win_bonus INTEGER := 50;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- XP for creator
    INSERT INTO xp_events (user_id, event_type, xp_gained, description, related_bet_id)
    VALUES (NEW.creator_id, 'deal_completed', base_xp, 'Deal abgeschlossen', NEW.id);
    UPDATE profiles SET xp = xp + base_xp, deals_total = deals_total + 1 WHERE id = NEW.creator_id;

    -- XP for opponent
    IF NEW.opponent_id IS NOT NULL THEN
      INSERT INTO xp_events (user_id, event_type, xp_gained, description, related_bet_id)
      VALUES (NEW.opponent_id, 'deal_completed', base_xp, 'Deal abgeschlossen', NEW.id);
      UPDATE profiles SET xp = xp + base_xp, deals_total = deals_total + 1 WHERE id = NEW.opponent_id;
    END IF;

    -- Bonus XP + win counter for winner
    IF NEW.winner_id IS NOT NULL THEN
      INSERT INTO xp_events (user_id, event_type, xp_gained, description, related_bet_id)
      VALUES (NEW.winner_id, 'deal_won', win_bonus, 'Deal gewonnen 🏆', NEW.id);
      UPDATE profiles SET xp = xp + win_bonus, wins = wins + 1 WHERE id = NEW.winner_id;
    END IF;

    -- Update rivalry intensity
    IF NEW.creator_id IS NOT NULL AND NEW.opponent_id IS NOT NULL THEN
      INSERT INTO rivalries (user_id, rival_id, total_deals, rivalry_intensity)
      VALUES (NEW.creator_id, NEW.opponent_id, 1, 5)
      ON CONFLICT (user_id, rival_id) DO UPDATE
        SET total_deals = rivalries.total_deals + 1,
            rivalry_intensity = LEAST(rivalries.rivalry_intensity + 5, 100),
            wins = CASE WHEN NEW.winner_id = rivalries.user_id THEN rivalries.wins + 1 ELSE rivalries.wins END,
            losses = CASE WHEN NEW.winner_id != rivalries.user_id AND NEW.winner_id IS NOT NULL THEN rivalries.losses + 1 ELSE rivalries.losses END,
            is_heated = (LEAST(rivalries.rivalry_intensity + 5, 100) >= 50),
            is_legendary = (LEAST(rivalries.rivalry_intensity + 5, 100) >= 80),
            updated_at = NOW();

      INSERT INTO rivalries (user_id, rival_id, total_deals, rivalry_intensity)
      VALUES (NEW.opponent_id, NEW.creator_id, 1, 5)
      ON CONFLICT (user_id, rival_id) DO UPDATE
        SET total_deals = rivalries.total_deals + 1,
            rivalry_intensity = LEAST(rivalries.rivalry_intensity + 5, 100),
            wins = CASE WHEN NEW.winner_id = rivalries.user_id THEN rivalries.wins + 1 ELSE rivalries.wins END,
            losses = CASE WHEN NEW.winner_id != rivalries.user_id AND NEW.winner_id IS NOT NULL THEN rivalries.losses + 1 ELSE rivalries.losses END,
            is_heated = (LEAST(rivalries.rivalry_intensity + 5, 100) >= 50),
            is_legendary = (LEAST(rivalries.rivalry_intensity + 5, 100) >= 80),
            updated_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_deal_completed
  AFTER UPDATE ON bets
  FOR EACH ROW EXECUTE FUNCTION public.handle_deal_completed();

-- Level-up function (called after XP update)
CREATE OR REPLACE FUNCTION public.check_level_up()
RETURNS TRIGGER AS $$
DECLARE
  new_level INTEGER;
BEGIN
  new_level := FLOOR(NEW.xp / 100) + 1;
  IF new_level > NEW.level THEN
    UPDATE profiles SET level = new_level, coins = coins + (new_level - NEW.level) * 10
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_xp_change
  AFTER UPDATE OF xp ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_level_up();

-- =============================================
-- SEED DATA
-- =============================================

-- Season 1
INSERT INTO seasons (id, name, theme, is_active, exclusive_frame_id, exclusive_badge_id, exclusive_title)
VALUES (1, 'The Founders Era', 'founders', true, 'founder_carbon', 'season1_founder', 'Gründer')
ON CONFLICT (id) DO NOTHING;

-- Cosmetics Catalog
INSERT INTO cosmetics (id, name, description, item_type, rarity, coin_price, is_purchasable, is_season_exclusive, season_available, unlock_condition) VALUES
  ('founder_carbon',   'Founder Carbon',   'Nur Season 1 Gründer',              'frame',  'legendary', 0,   false, true,  1, 'founder'),
  ('midas_touch',      'The Midas Touch',  'Goldener Rahmen mit Funken',         'frame',  'legendary', 500, true,  false, null, null),
  ('samurai_blade',    'Samurai Blade',    'Scharfer epischer Rahmen',           'frame',  'epic',      250, true,  false, null, null),
  ('blue_steel',       'Blue Steel',       'Klassisch & clean',                  'frame',  'rare',      100, true,  false, null, null),
  ('stone_cold',       'Stone Cold',       'Minimalistisch',                     'frame',  'common',    50,  true,  false, null, null),
  ('season1_founder',  'Season 1 Founder', 'Erstes Kapitel',                     'badge',  'legendary', 0,   false, true,  1, 'founder'),
  ('untouchable',      'Untouchable',      '10 Siege in Folge',                  'badge',  'epic',      0,   false, false, null, 'streak_10'),
  ('street_legend',    'Street Legend',    'Level 50 erreicht',                  'badge',  'epic',      0,   false, false, null, 'level_50'),
  ('the_architect',    'The Architect',    '50 Deals erstellt',                  'badge',  'rare',      0,   false, false, null, 'deals_50')
ON CONFLICT (id) DO NOTHING;

-- Battle Pass Rewards (Season 1, Free Track)
INSERT INTO battle_pass_rewards (season_id, level, track, reward_type, reward_value, reward_amount) VALUES
  (1, 1,  'free',    'coins',  null, 50),
  (1, 3,  'free',    'badge',  'the_architect', 0),
  (1, 5,  'free',    'coins',  null, 100),
  (1, 10, 'free',    'frame',  'stone_cold', 0),
  (1, 15, 'free',    'coins',  null, 150),
  (1, 20, 'free',    'frame',  'blue_steel', 0),
  (1, 25, 'free',    'coins',  null, 200),
  (1, 30, 'free',    'badge',  'untouchable', 0),
  -- Premium Track
  (1, 1,  'premium', 'frame',  'samurai_blade', 0),
  (1, 5,  'premium', 'coins',  null, 200),
  (1, 10, 'premium', 'coins',  null, 300),
  (1, 15, 'premium', 'frame',  'midas_touch', 0),
  (1, 20, 'premium', 'coins',  null, 500),
  (1, 30, 'premium', 'badge',  'street_legend', 0)
ON CONFLICT DO NOTHING;
