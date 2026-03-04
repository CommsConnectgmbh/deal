-- ============================================================
-- DealBuddy MIGRATION V8 – Phase 2 & 3 Complete
-- Neue Slots, Rewards, Challenges, Reactions, Onboarding
-- Run in Supabase SQL Editor AFTER V7
-- ============================================================

-- ─── 1. Avatar System: neue Slots + Items ─────────────────────────────────────

-- Erweitere den slot-Constraint um neue Slot-Typen
ALTER TABLE avatar_items DROP CONSTRAINT IF EXISTS avatar_items_slot_check;
ALTER TABLE avatar_items ADD CONSTRAINT avatar_items_slot_check
  CHECK (slot IN ('body','hair','headwear','top','bottom','shoes','accessory','background','skin_tone'));

-- Erweitere avatar_config um neue Slots
ALTER TABLE avatar_config
  ADD COLUMN IF NOT EXISTS skin_tone  TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS headwear   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS top        TEXT DEFAULT 'top_tshirt',
  ADD COLUMN IF NOT EXISTS bottom     TEXT DEFAULT 'bottom_slim',
  ADD COLUMN IF NOT EXISTS shoes      TEXT DEFAULT 'shoes_sneaker',
  ADD COLUMN IF NOT EXISTS background TEXT DEFAULT 'bg_dark';

-- Alte Spalten umbenennen (Kompatibilität)
-- outfit → top, hair bleibt, accessory bleibt

-- ─── 2. Neue Avatar Items seeden ──────────────────────────────────────────────

-- Skin Tones
INSERT INTO avatar_items (id, slot, name, description, rarity, price_coins, icon_emoji, is_default) VALUES
  ('skin_light',         'skin_tone', 'Light',         'Helle Hautfarbe',          'common', 0,    '🏻', true),
  ('skin_medium_light',  'skin_tone', 'Medium Light',  'Mittelhelle Hautfarbe',    'common', 0,    '🏼', false),
  ('skin_medium',        'skin_tone', 'Medium',        'Mittlere Hautfarbe',       'common', 0,    '🏽', false),
  ('skin_medium_dark',   'skin_tone', 'Medium Dark',   'Mitteldunkle Hautfarbe',   'common', 0,    '🏾', false),
  ('skin_dark',          'skin_tone', 'Dark',          'Dunkle Hautfarbe',         'common', 0,    '🏿', false)
ON CONFLICT (id) DO NOTHING;

-- Hair Styles (neue Items)
INSERT INTO avatar_items (id, slot, name, description, rarity, price_coins, icon_emoji, is_default) VALUES
  ('hair_short_textured', 'hair', 'Short Textured',  'Kurz, strukturiert',       'common',    0,    '✂️',  true),
  ('hair_buzzcut',        'hair', 'Buzzcut',          'Sehr kurz rasiert',        'common',    100,  '🔪',  false),
  ('hair_medium_wavy',    'hair', 'Medium Wavy',      'Mittellang, wellig',       'rare',      200,  '🌊',  false),
  ('hair_braids',         'hair', 'Braids',           'Coole Zöpfe/Braids',       'rare',      300,  '💈',  false),
  ('hair_slicked_back',   'hair', 'Slicked Back',     'Nach hinten gekämmt',      'epic',      500,  '⚡',  false)
ON CONFLICT (id) DO NOTHING;

-- Headwear
INSERT INTO avatar_items (id, slot, name, description, rarity, price_coins, icon_emoji, is_default) VALUES
  ('hw_cap',      'headwear', 'Cap',      'Basecap nach vorne',  'common', 150,  '🧢', false),
  ('hw_beanie',   'headwear', 'Beanie',   'Warme Wollmütze',     'rare',   300,  '🎩', false),
  ('hw_bandana',  'headwear', 'Bandana',  'Style Bandana',       'rare',   350,  '🏴', false)
ON CONFLICT (id) DO NOTHING;

-- Tops
INSERT INTO avatar_items (id, slot, name, description, rarity, price_coins, icon_emoji, is_default) VALUES
  ('top_tshirt',    'top', 'Clean T-Shirt', 'Schlichtes T-Shirt',      'common',    0,    '👕',  true),
  ('top_hoodie',    'top', 'Hoodie',        'Streetwear Hoodie',       'common',    200,  '🧥',  false),
  ('top_bomber',    'top', 'Bomber Jacket', 'Premium Bomber Jacket',   'rare',      400,  '🎽',  false),
  ('top_zip',       'top', 'Zip Hoodie',    'Zip-Up Hoodie',           'rare',      350,  '🧥',  false),
  ('top_denim',     'top', 'Denim Jacket',  'Classic Denim Jacket',    'epic',      600,  '👔',  false)
ON CONFLICT (id) DO NOTHING;

-- Bottoms
INSERT INTO avatar_items (id, slot, name, description, rarity, price_coins, icon_emoji, is_default) VALUES
  ('bottom_slim',    'bottom', 'Slim Pants',   'Slim Fit Hose',         'common', 0,    '👖', true),
  ('bottom_jogger',  'bottom', 'Joggers',      'Bequeme Jogger',        'common', 150,  '🩱', false),
  ('bottom_cargo',   'bottom', 'Cargo Pants',  'Multi-Pocket Cargos',   'rare',   300,  '🪖', false),
  ('bottom_shorts',  'bottom', 'Shorts',       'Casual Shorts',         'common', 100,  '🩳', false)
ON CONFLICT (id) DO NOTHING;

-- Shoes
INSERT INTO avatar_items (id, slot, name, description, rarity, price_coins, icon_emoji, is_default) VALUES
  ('shoes_sneaker',    'shoes', 'Classic Sneakers', 'AF1-Style Sneakers',      'common',  0,    '👟', true),
  ('shoes_hightop',    'shoes', 'High-Tops',         'High-Top Sneakers',       'rare',    350,  '👟', false),
  ('shoes_boots',      'shoes', 'Boots',             'Stylische Boots',         'rare',    400,  '👢', false),
  ('shoes_lowtop',     'shoes', 'Low-Top Clean',     'Clean Low-Top Sneakers',  'common',  200,  '👟', false)
ON CONFLICT (id) DO NOTHING;

-- Accessories (Chain, Watch, Glasses, Earring)
INSERT INTO avatar_items (id, slot, name, description, rarity, price_coins, icon_emoji, is_default) VALUES
  ('acc_chain',    'accessory', 'Chain',    'Goldene Halskette',     'rare',      300,  '⛓️', false),
  ('acc_watch',    'accessory', 'Watch',    'Luxus Armbanduhr',      'epic',      500,  '⌚',  false),
  ('acc_earring',  'accessory', 'Earring',  'Kleiner Ohrring',       'common',    100,  '💎',  false)
ON CONFLICT (id) DO NOTHING;

-- Backgrounds
INSERT INTO avatar_items (id, slot, name, description, rarity, price_coins, icon_emoji, is_default) VALUES
  ('bg_dark',         'background', 'Default Dark',    'Dunkel mit Gradient',         'common',    0,    '🌑', true),
  ('bg_gold_prestige','background', 'Gold Prestige',   'Gold Glow Hintergrund',       'legendary', 1500, '✨', false),
  ('bg_smoke',        'background', 'Smoke',           'Mystischer Rauch-Effekt',     'epic',      800,  '💨', false)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Deals: category Feld ──────────────────────────────────────────────────
ALTER TABLE bets ADD COLUMN IF NOT EXISTS category TEXT
  CHECK (category IN ('fitness','gaming','wissen','social','custom'));
ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS confirmed_winner_id UUID REFERENCES profiles(id);

-- ─── 4. Profiles: onboarding_completed ────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id);

-- Generate invite codes for existing profiles
UPDATE profiles SET invite_code = 'DEAL-' || UPPER(SUBSTR(MD5(id::TEXT), 1, 5))
WHERE invite_code IS NULL;

-- ─── 5. Referrals Tabelle ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed       BOOLEAN DEFAULT false,  -- true when referred user completes first deal
  reward_granted  BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id)
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referrals_select_own" ON referrals;
CREATE POLICY "referrals_select_own" ON referrals
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- ─── 6. Milestone Rewards ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milestone_rewards (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  level_required  INTEGER NOT NULL UNIQUE,
  reward_type     TEXT NOT NULL CHECK (reward_type IN ('coins','avatar_item','cosmetic')),
  reward_ref      TEXT NULL,
  reward_amount   INTEGER NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  rarity          TEXT NOT NULL DEFAULT 'common'
    CHECK (rarity IN ('common','rare','epic','legendary'))
);
ALTER TABLE milestone_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "milestone_rewards_read" ON milestone_rewards FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS user_milestones (
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  milestone_id    UUID NOT NULL REFERENCES milestone_rewards(id) ON DELETE CASCADE,
  claimed         BOOLEAN DEFAULT false,
  claimed_at      TIMESTAMPTZ,
  PRIMARY KEY (user_id, milestone_id)
);
ALTER TABLE user_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_milestones_own" ON user_milestones FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Seed Season 1 Milestones
INSERT INTO milestone_rewards (level_required, reward_type, reward_ref, reward_amount, name, description, rarity) VALUES
  (3,  'coins',     NULL,             100,  'Erster Schritt',          'Willkommen! Du hast Level 3 erreicht.',            'common'),
  (5,  'cosmetic',  'badge_rising',   NULL, 'Rising Star',             'Ein aufgehender Stern – Badge für Level 5.',       'common'),
  (8,  'coins',     NULL,             200,  'Im Aufstieg',             '200 Coins für Level 8!',                           'common'),
  (10, 'cosmetic',  'frame_contend',  NULL, 'Contender',               'Contender Frame – selten und verdient.',           'rare'),
  (13, 'coins',     NULL,             300,  'Halbzeit-Bonus',          'Auf dem Weg zur Legende.',                         'common'),
  (15, 'cosmetic',  'title_rival',    NULL, 'Rival Master',            'Rival Master Title für Level 15.',                 'rare'),
  (18, 'coins',     NULL,             400,  'Elite-Niveau',            'Du gehörst zur Elite.',                            'common'),
  (20, 'cosmetic',  'frame_prestige', NULL, 'Prestige',                'Animierter Prestige Frame – episch!',              'epic'),
  (23, 'coins',     NULL,             500,  'Profi-Level',             'Top-Tier Coins Bonus.',                            'common'),
  (25, 'cosmetic',  'badge_elite',    NULL, 'Elite Badge',             'Elite Badge für die Besten.',                      'epic'),
  (28, 'coins',     NULL,             750,  'Fast am Gipfel',          'Massive Coins für Level 28.',                      'common'),
  (30, 'cosmetic',  'frame_legend',   NULL, 'Legend Frame',            'Legendärer animierter Frame + Titel.',             'legendary'),
  (40, 'cosmetic',  'anim_unstop',    NULL, 'Unstoppable',             'Victory Animation für die Härtesten.',            'legendary'),
  (50, 'cosmetic',  'frame_mythic',   NULL, 'Mythic Founder',          'Exklusiver Mythic Frame – höchste Stufe.',         'legendary')
ON CONFLICT (level_required) DO NOTHING;

-- ─── 7. Streak Rewards ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS streak_rewards (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  streak_count  INTEGER NOT NULL UNIQUE,
  reward_type   TEXT NOT NULL CHECK (reward_type IN ('coins','avatar_item','cosmetic')),
  reward_ref    TEXT NULL,
  reward_amount INTEGER NULL,
  name          TEXT NOT NULL,
  rarity        TEXT NOT NULL DEFAULT 'common'
    CHECK (rarity IN ('common','rare','epic','legendary'))
);
ALTER TABLE streak_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streak_rewards_read" ON streak_rewards FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS user_streak_rewards (
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  streak_reward_id  UUID NOT NULL REFERENCES streak_rewards(id) ON DELETE CASCADE,
  claimed           BOOLEAN DEFAULT false,
  claimed_at        TIMESTAMPTZ,
  PRIMARY KEY (user_id, streak_reward_id)
);
ALTER TABLE user_streak_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_streak_rewards_own" ON user_streak_rewards FOR ALL TO authenticated USING (auth.uid() = user_id);

INSERT INTO streak_rewards (streak_count, reward_type, reward_ref, reward_amount, name, rarity) VALUES
  (3,  'coins',     NULL,              75,  '3er Streak – Heiß!',      'common'),
  (5,  'cosmetic',  'badge_hot',       NULL, '5er Streak – Hot Streak', 'rare'),
  (7,  'coins',     NULL,              200, '7er Streak – Inferno',    'rare'),
  (10, 'cosmetic',  'frame_on_fire',   NULL, '10er Streak – On Fire',   'epic'),
  (15, 'cosmetic',  'title_unstop',    NULL, '15er Streak – Unstoppable','epic'),
  (20, 'cosmetic',  'frame_inferno',   NULL, '20er Streak – Inferno!',  'legendary')
ON CONFLICT (streak_count) DO NOTHING;

-- ─── 8. Daily Login Rewards ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_login_rewards (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_number   INTEGER NOT NULL UNIQUE CHECK (day_number BETWEEN 1 AND 7),
  reward_type  TEXT NOT NULL CHECK (reward_type IN ('coins','avatar_item','cosmetic')),
  reward_ref   TEXT NULL,
  reward_amount INTEGER NULL,
  name         TEXT NOT NULL,
  rarity       TEXT NOT NULL DEFAULT 'common'
);
ALTER TABLE daily_login_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_login_rewards_read" ON daily_login_rewards FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS user_daily_login (
  user_id           UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_day       INTEGER NOT NULL DEFAULT 1,
  last_login_date   DATE,
  cycle_start_date  DATE DEFAULT CURRENT_DATE,
  total_logins      INTEGER DEFAULT 0
);
ALTER TABLE user_daily_login ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_daily_login_own" ON user_daily_login FOR ALL TO authenticated USING (auth.uid() = user_id);

INSERT INTO daily_login_rewards (day_number, reward_type, reward_amount, reward_ref, name, rarity) VALUES
  (1, 'coins', 25,   NULL,           'Tag 1 – Guten Morgen!',    'common'),
  (2, 'coins', 50,   NULL,           'Tag 2 – Dabei bleiben!',   'common'),
  (3, 'coins', 75,   NULL,           'Tag 3 – Auf dem Weg!',     'common'),
  (4, 'coins', 100,  NULL,           'Tag 4 – Halbzeit!',        'common'),
  (5, 'cosmetic', NULL, 'badge_daily','Tag 5 – Daily Grinder',   'common'),
  (6, 'coins', 150,  NULL,           'Tag 6 – Fast geschafft!',  'rare'),
  (7, 'coins', 250,  NULL,           'Tag 7 – Streak komplett!', 'rare')
ON CONFLICT (day_number) DO NOTHING;

-- ─── 9. Season Challenges ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS season_challenges (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id           INTEGER NOT NULL DEFAULT 1,
  title               TEXT NOT NULL,
  description         TEXT,
  requirement_type    TEXT NOT NULL
    CHECK (requirement_type IN ('total_wins','total_deals','unique_opponents','streak_max','category_wins','follows','referrals')),
  requirement_count   INTEGER NOT NULL,
  reward_type         TEXT NOT NULL CHECK (reward_type IN ('coins','avatar_item','cosmetic')),
  reward_ref          TEXT NULL,
  reward_amount       INTEGER NULL,
  reward_rarity       TEXT NOT NULL DEFAULT 'common'
    CHECK (reward_rarity IN ('common','rare','epic','legendary'))
);
ALTER TABLE season_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "season_challenges_read" ON season_challenges FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS user_season_challenges (
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES season_challenges(id) ON DELETE CASCADE,
  progress     INTEGER DEFAULT 0,
  completed    BOOLEAN DEFAULT false,
  claimed      BOOLEAN DEFAULT false,
  PRIMARY KEY (user_id, challenge_id)
);
ALTER TABLE user_season_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_season_challenges_own" ON user_season_challenges FOR ALL TO authenticated USING (auth.uid() = user_id);

INSERT INTO season_challenges (title, description, requirement_type, requirement_count, reward_type, reward_ref, reward_amount, reward_rarity) VALUES
  ('Newcomer',           'Gewinne 10 Deals insgesamt',              'total_wins',        10,  'cosmetic', 'badge_first_blood', NULL, 'common'),
  ('Vielseitig',         'Erstelle Deals in 3 verschiedenen Kategorien', 'category_wins', 3,   'coins',    NULL, 300, 'common'),
  ('Rivalitäts-Starter', 'Gewinne 3 Deals gegen verschiedene Gegner', 'unique_opponents', 3,  'cosmetic', 'frame_rival_start', NULL, 'rare'),
  ('Netzwerker',         'Folge 20 Usern',                          'follows',           20,  'cosmetic', 'badge_connected',  NULL, 'rare'),
  ('Dominator',          'Gewinne 50 Deals insgesamt',              'total_wins',        50,  'cosmetic', 'title_dominator',  NULL, 'epic'),
  ('Legend',             'Erreiche eine 10er Streak',               'streak_max',        10,  'cosmetic', 'frame_legend_str', NULL, 'epic'),
  ('The Founder',        'Gewinne 100 Deals in Season 1',           'total_wins',        100, 'cosmetic', 'frame_the_founder',NULL, 'legendary')
ON CONFLICT DO NOTHING;

-- ─── 10. Weekly Challenges ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_challenges (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id       INTEGER DEFAULT 1,
  week_number     INTEGER NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  requirement_type TEXT NOT NULL
    CHECK (requirement_type IN ('deals_created','wins','follows','streak','deals_any')),
  requirement_count INTEGER NOT NULL,
  reward_xp       INTEGER DEFAULT 0,
  reward_coins    INTEGER DEFAULT 0,
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ
);
ALTER TABLE weekly_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_challenges_read" ON weekly_challenges FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS user_weekly_challenges (
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id  UUID NOT NULL REFERENCES weekly_challenges(id) ON DELETE CASCADE,
  progress      INTEGER DEFAULT 0,
  completed     BOOLEAN DEFAULT false,
  claimed       BOOLEAN DEFAULT false,
  PRIMARY KEY (user_id, challenge_id)
);
ALTER TABLE user_weekly_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_weekly_challenges_own" ON user_weekly_challenges FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Woche 1 Challenges
INSERT INTO weekly_challenges (week_number, title, description, requirement_type, requirement_count, reward_xp, reward_coins,
  start_date, end_date) VALUES
  (1, 'Herausforderer',  'Erstelle 3 Deals diese Woche',      'deals_created', 3, 150, 100, NOW(), NOW() + INTERVAL '7 days'),
  (1, 'Siegesserie',     'Gewinne 3 Deals in Folge',          'wins',          3, 200, 150, NOW(), NOW() + INTERVAL '7 days'),
  (1, 'Netzwerker',      'Folge 5 neuen Usern',               'follows',       5, 100, 50,  NOW(), NOW() + INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- ─── 11. Deal Reactions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_reactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id     UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction    TEXT NOT NULL CHECK (reaction IN ('fire','funny','shocked','savage')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deal_id, user_id)
);
ALTER TABLE deal_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deal_reactions_select" ON deal_reactions;
CREATE POLICY "deal_reactions_select" ON deal_reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "deal_reactions_insert" ON deal_reactions;
CREATE POLICY "deal_reactions_insert" ON deal_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "deal_reactions_delete" ON deal_reactions;
CREATE POLICY "deal_reactions_delete" ON deal_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── 12. Weekly Spotlight ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_spotlight (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id     UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  week_start  DATE NOT NULL UNIQUE,
  bonus_xp    INTEGER DEFAULT 100,
  bonus_coins INTEGER DEFAULT 50,
  granted     BOOLEAN DEFAULT false
);
ALTER TABLE weekly_spotlight ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_spotlight_read" ON weekly_spotlight FOR SELECT TO authenticated USING (true);

-- ─── 13. Push Notification Subscriptions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL,
  p256dh        TEXT NOT NULL,
  auth_key      TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_sub_own" ON push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id);

-- ─── 14. Leaderboard Views ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard_level AS
  SELECT id, username, display_name, level, xp, active_frame, active_badge, streak,
    primary_archetype, is_founder
  FROM profiles
  WHERE deleted_at IS NULL
  ORDER BY level DESC, xp DESC
  LIMIT 100;

CREATE OR REPLACE VIEW leaderboard_streak AS
  SELECT id, username, display_name, level, streak, active_frame, active_badge,
    primary_archetype, is_founder
  FROM profiles
  WHERE deleted_at IS NULL AND streak > 0
  ORDER BY streak DESC, level DESC
  LIMIT 100;

CREATE OR REPLACE VIEW leaderboard_wins AS
  SELECT id, username, display_name, level, wins, active_frame, active_badge,
    primary_archetype, is_founder
  FROM profiles
  WHERE deleted_at IS NULL
  ORDER BY wins DESC, level DESC
  LIMIT 100;

CREATE OR REPLACE VIEW leaderboard_deals AS
  SELECT id, username, display_name, level, deals_total, active_frame, active_badge,
    primary_archetype, is_founder
  FROM profiles
  WHERE deleted_at IS NULL
  ORDER BY deals_total DESC, level DESC
  LIMIT 100;

-- ─── 15. Initialize daily_login for existing users ────────────────────────────
INSERT INTO user_daily_login (user_id, current_day, last_login_date, cycle_start_date)
SELECT id, 1, NULL, CURRENT_DATE
FROM profiles
ON CONFLICT (user_id) DO NOTHING;

-- ─── 16. RLS auf Views ────────────────────────────────────────────────────────
-- Views erben RLS der Basis-Tabelle (profiles) – kein extra nötig

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- Phase 2 & 3 DB Migration abgeschlossen.
-- Neue Tabellen: milestone_rewards, user_milestones, streak_rewards,
-- user_streak_rewards, daily_login_rewards, user_daily_login,
-- season_challenges, user_season_challenges, weekly_challenges,
-- user_weekly_challenges, deal_reactions, weekly_spotlight,
-- push_subscriptions, referrals
-- Neue Felder: bets.category, bets.is_public, profiles.onboarding_completed,
-- profiles.invite_code, profiles.referred_by,
-- avatar_config.skin_tone/headwear/top/bottom/shoes/background
