-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION V11 — Complete Store, Frame & Unlock System        ║
-- ║  DealBuddy PWA                                                ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── 1. EVENTS TABLE ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name_de TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_de TEXT,
  description_en TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT false,
  event_type TEXT DEFAULT 'frame_event'
    CHECK (event_type IN ('frame_event','coin_event','xp_event')),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. FRAME DEFINITIONS TABLE ─────────────────────────────────

CREATE TABLE IF NOT EXISTS frame_definitions (
  id TEXT PRIMARY KEY,
  name_de TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_de TEXT,
  description_en TEXT,
  icon_emoji TEXT NOT NULL DEFAULT '💎',
  rarity TEXT NOT NULL DEFAULT 'common'
    CHECK (rarity IN ('common','rare','epic','legendary','founder','event')),
  category TEXT NOT NULL DEFAULT 'shop'
    CHECK (category IN ('shop','prestige','event')),
  coin_price INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_animated BOOLEAN DEFAULT false,
  frame_color TEXT NOT NULL DEFAULT '#CD7F32',
  frame_glow TEXT NOT NULL DEFAULT 'rgba(205,127,50,0.4)',
  prestige_condition JSONB DEFAULT NULL,
  event_id UUID DEFAULT NULL REFERENCES events(id),
  event_condition JSONB DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. USER EVENT PROGRESS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_event_progress (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  progress JSONB DEFAULT '{}',
  completed BOOLEAN DEFAULT false,
  claimed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

-- ─── 4. FRAME PACKS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS frame_packs (
  id TEXT PRIMARY KEY,
  name_de TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_de TEXT,
  description_en TEXT,
  icon_emoji TEXT NOT NULL DEFAULT '📦',
  coin_price INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0,
  rarity TEXT DEFAULT 'common',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 5. FRAME PACK LOOT TABLE ───────────────────────────────────

CREATE TABLE IF NOT EXISTS frame_pack_loot_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES frame_packs(id),
  reward_type TEXT NOT NULL
    CHECK (reward_type IN ('frame','coins','event_points','event_boost','event_progress')),
  reward_value TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 100,
  min_qty INTEGER DEFAULT 1,
  max_qty INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 6. USER PACK HISTORY ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_pack_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pack_id TEXT NOT NULL REFERENCES frame_packs(id),
  reward_type TEXT NOT NULL,
  reward_value TEXT NOT NULL,
  reward_qty INTEGER DEFAULT 1,
  is_duplicate BOOLEAN DEFAULT false,
  coins_refunded INTEGER DEFAULT 0,
  opened_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_pack_history_pity
  ON user_pack_history(user_id, pack_id, opened_at DESC);

-- ─── 7. USER FRAME PROGRESS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_frame_progress (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  frame_id TEXT NOT NULL,
  current_value INTEGER DEFAULT 0,
  target_value INTEGER NOT NULL,
  progress_pct DECIMAL(5,2) DEFAULT 0,
  is_eligible BOOLEAN DEFAULT false,
  is_claimable BOOLEAN DEFAULT false,
  last_computed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, frame_id)
);

-- ─── 8. RLS POLICIES ────────────────────────────────────────────

ALTER TABLE frame_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "frame_definitions_public_read" ON frame_definitions;
CREATE POLICY "frame_definitions_public_read" ON frame_definitions FOR SELECT USING (true);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_public_read" ON events;
CREATE POLICY "events_public_read" ON events FOR SELECT USING (true);

ALTER TABLE user_event_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_event_progress_own_read" ON user_event_progress;
CREATE POLICY "user_event_progress_own_read" ON user_event_progress FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE frame_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "frame_packs_public_read" ON frame_packs;
CREATE POLICY "frame_packs_public_read" ON frame_packs FOR SELECT USING (true);

ALTER TABLE frame_pack_loot_table ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "frame_pack_loot_public_read" ON frame_pack_loot_table;
CREATE POLICY "frame_pack_loot_public_read" ON frame_pack_loot_table FOR SELECT USING (true);

ALTER TABLE user_pack_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_pack_history_own_read" ON user_pack_history;
CREATE POLICY "user_pack_history_own_read" ON user_pack_history FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE user_frame_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_frame_progress_own_read" ON user_frame_progress;
CREATE POLICY "user_frame_progress_own_read" ON user_frame_progress FOR SELECT USING (auth.uid() = user_id);

-- Service role policies (for edge functions)
DROP POLICY IF EXISTS "user_event_progress_service" ON user_event_progress;
CREATE POLICY "user_event_progress_service" ON user_event_progress FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_pack_history_service" ON user_pack_history;
CREATE POLICY "user_pack_history_service" ON user_pack_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_frame_progress_service" ON user_frame_progress;
CREATE POLICY "user_frame_progress_service" ON user_frame_progress FOR ALL USING (true) WITH CHECK (true);

-- ─── 9. SEED: FRAME DEFINITIONS ─────────────────────────────────

INSERT INTO frame_definitions (id, name_de, name_en, description_de, description_en, icon_emoji, rarity, category, coin_price, sort_order, is_animated, frame_color, frame_glow, prestige_condition) VALUES
-- SHOP FRAMES (purchasable with coins)
('bronze',   'Bronze',   'Bronze',   'Der Einstieg in die Welt der Rahmen',    'The entry into the world of frames',     '🥉', 'common',    'shop', 100,  1,  false, '#CD7F32', 'rgba(205,127,50,0.4)',  NULL),
('silver',   'Silber',   'Silver',   'Schlicht und edel',                       'Simple and noble',                        '🩶', 'common',    'shop', 200,  2,  false, '#C0C0C0', 'rgba(192,192,192,0.4)', NULL),
('gold',     'Gold',     'Gold',     'Pures Gold fur wahre Gewinner',           'Pure gold for true winners',              '✨', 'rare',      'shop', 500,  3,  false, '#F59E0B', 'rgba(245,158,11,0.5)', NULL),
('emerald',  'Smaragd',  'Emerald',  'Seltener Edelstein der Natur',            'Rare gemstone of nature',                 '💚', 'epic',      'shop', 1000, 4,  false, '#22C55E', 'rgba(34,197,94,0.5)',  NULL),
('sapphire', 'Saphir',   'Sapphire', 'Tiefes Blau der Ozeane',                 'Deep blue of the oceans',                 '💎', 'epic',      'shop', 1200, 5,  false, '#3B82F6', 'rgba(59,130,246,0.5)', NULL),
('ruby',     'Rubin',    'Ruby',     'Feuer und Leidenschaft',                  'Fire and passion',                        '❤️‍🔥','epic',     'shop', 1500, 6,  false, '#EF4444', 'rgba(239,68,68,0.5)', NULL),
('topaz',    'Topas',    'Topaz',    'Warme Eleganz des Sonnenuntergangs',      'Warm elegance of sunset',                 '🟡', 'epic',      'shop', 1800, 7,  false, '#F97316', 'rgba(249,115,22,0.5)', NULL),
('obsidian', 'Obsidian', 'Obsidian', 'Dunkle Macht aus den Tiefen',             'Dark power from the depths',              '🖤', 'legendary', 'shop', 2500, 8,  true,  '#6B7280', 'rgba(107,114,128,0.5)', NULL),
-- PRESTIGE FRAMES (earned only, NOT purchasable)
('crystal',  'Kristall', 'Crystal',  'Mystische Klarheit fur Champions',        'Mystic clarity for champions',            '🔮', 'legendary', 'prestige', 0, 10, false, '#8B5CF6', 'rgba(139,92,246,0.5)', '{"type":"challenge_wins","target":50}'),
('legend',   'Legende',  'Legend',   'Nur die besten einer Season',             'Only the best of a season',               '⭐', 'legendary', 'prestige', 0, 11, true,  '#FBBF24', 'rgba(251,191,36,0.6)', '{"type":"season_leaderboard_top","target":10}'),
('icon',     'Ikone',    'Icon',     'Fur die aktivsten Challenge-Ersteller',   'For the most active challenge creators',  '🌟', 'legendary', 'prestige', 0, 12, true,  '#A78BFA', 'rgba(167,139,250,0.6)', '{"type":"challenges_created","target":100}'),
('hero',     'Held',     'Hero',     'Erreiche eine epische Siegesserie',       'Achieve an epic win streak',              '🦸', 'legendary', 'prestige', 0, 13, true,  '#60A5FA', 'rgba(96,165,250,0.6)', '{"type":"win_streak","target":10}'),
('founder',  'Founder',  'Founder',  'Exklusiv fur DealBuddy Grunder',          'Exclusive for DealBuddy founders',        '👑', 'founder',   'prestige', 0, 14, true,  '#F59E0B', 'rgba(245,158,11,0.6)', '{"type":"founder_flag","target":1}')
ON CONFLICT (id) DO UPDATE SET
  name_de = EXCLUDED.name_de,
  name_en = EXCLUDED.name_en,
  description_de = EXCLUDED.description_de,
  description_en = EXCLUDED.description_en,
  icon_emoji = EXCLUDED.icon_emoji,
  rarity = EXCLUDED.rarity,
  category = EXCLUDED.category,
  coin_price = EXCLUDED.coin_price,
  sort_order = EXCLUDED.sort_order,
  is_animated = EXCLUDED.is_animated,
  frame_color = EXCLUDED.frame_color,
  frame_glow = EXCLUDED.frame_glow,
  prestige_condition = EXCLUDED.prestige_condition;

-- EVENT FRAMES (time-limited, earned via events)
INSERT INTO frame_definitions (id, name_de, name_en, description_de, description_en, icon_emoji, rarity, category, coin_price, sort_order, is_animated, frame_color, frame_glow, event_condition) VALUES
('futties',            'Futties',          'Futties',          'Schliesse 5 Challenges wahrend des Futties Events ab',   'Complete 5 challenges during the Futties event',           '🎆', 'event', 'event', 0, 20, true, '#EC4899', 'rgba(236,72,153,0.6)', '{"type":"event_challenges","target":5}'),
('neon',               'Neon',             'Neon',             'Logge dich 7 Tage ein und schliesse 3 Challenges ab',    'Log in 7 days and complete 3 challenges',                   '💡', 'event', 'event', 0, 21, true, '#34D399', 'rgba(52,211,153,0.6)', '{"type":"event_multi","targets":{"login_days":7,"challenges":3}}'),
('celestial',          'Himmlisch',        'Celestial',        'Erreiche 3000 Event-Punkte',                              'Reach 3000 event points',                                   '🌠', 'event', 'event', 0, 22, true, '#E0E7FF', 'rgba(224,231,255,0.5)', '{"type":"event_points","target":3000}'),
('player_of_the_week', 'Player der Woche', 'Player of the Week','Werde Rang 1 im Wochen-Leaderboard',                   'Reach Rank 1 on the weekly leaderboard',                    '🏆', 'event', 'event', 0, 23, true, '#FBBF24', 'rgba(251,191,36,0.6)', '{"type":"weekly_rank","target":1}')
ON CONFLICT (id) DO UPDATE SET
  name_de = EXCLUDED.name_de,
  name_en = EXCLUDED.name_en,
  description_de = EXCLUDED.description_de,
  description_en = EXCLUDED.description_en,
  icon_emoji = EXCLUDED.icon_emoji,
  rarity = EXCLUDED.rarity,
  category = EXCLUDED.category,
  coin_price = EXCLUDED.coin_price,
  sort_order = EXCLUDED.sort_order,
  is_animated = EXCLUDED.is_animated,
  frame_color = EXCLUDED.frame_color,
  frame_glow = EXCLUDED.frame_glow,
  event_condition = EXCLUDED.event_condition;

-- ─── 10. SEED: FRAME PACKS ──────────────────────────────────────

INSERT INTO frame_packs (id, name_de, name_en, description_de, description_en, icon_emoji, coin_price, sort_order, rarity) VALUES
('starter', 'Starter Pack',  'Starter Pack',  'Perfekt fur den Einstieg',            'Perfect for beginners',              '🎁', 400,  1, 'common'),
('pro',     'Pro Pack',      'Pro Pack',      'Hoherwertiger Loot fur Profis',       'Higher quality loot for pros',       '💎', 1200, 2, 'rare'),
('legend',  'Legend Pack',   'Legend Pack',    'Die besten Rahmen fur Legenden',      'The best frames for legends',        '🔥', 3000, 3, 'legendary'),
('event',   'Event Pack',    'Event Pack',    'Exklusiv wahrend Events verfugbar',   'Exclusively available during events','🎪', 1500, 4, 'event')
ON CONFLICT (id) DO UPDATE SET
  name_de = EXCLUDED.name_de,
  coin_price = EXCLUDED.coin_price;

-- ─── 11. SEED: LOOT TABLES ──────────────────────────────────────

-- Clear old loot tables first
DELETE FROM frame_pack_loot_table WHERE pack_id IN ('starter','pro','legend','event');

-- Starter Pack: 60% coins, 25% Bronze, 10% Silver, 5% Gold
INSERT INTO frame_pack_loot_table (pack_id, reward_type, reward_value, weight, min_qty, max_qty) VALUES
('starter', 'coins',  '100', 60, 50, 150),
('starter', 'frame',  'bronze', 25, 1, 1),
('starter', 'frame',  'silver', 10, 1, 1),
('starter', 'frame',  'gold',    5, 1, 1);

-- Pro Pack: 35% Gold, 25% Emerald, 20% Sapphire, 10% Ruby, 5% Topaz, 5% coins
INSERT INTO frame_pack_loot_table (pack_id, reward_type, reward_value, weight, min_qty, max_qty) VALUES
('pro', 'frame',  'gold',     35, 1, 1),
('pro', 'frame',  'emerald',  25, 1, 1),
('pro', 'frame',  'sapphire', 20, 1, 1),
('pro', 'frame',  'ruby',     10, 1, 1),
('pro', 'frame',  'topaz',     5, 1, 1),
('pro', 'coins',  '300',       5, 200, 400);

-- Legend Pack: 30% Emerald, 25% Sapphire, 20% Ruby, 15% Topaz, 5% Obsidian, 5% coins
INSERT INTO frame_pack_loot_table (pack_id, reward_type, reward_value, weight, min_qty, max_qty) VALUES
('legend', 'frame',  'emerald',  30, 1, 1),
('legend', 'frame',  'sapphire', 25, 1, 1),
('legend', 'frame',  'ruby',     20, 1, 1),
('legend', 'frame',  'topaz',    15, 1, 1),
('legend', 'frame',  'obsidian',  5, 1, 1),
('legend', 'coins',  '500',       5, 300, 700);

-- Event Pack: 50% event points, 25% coins, 15% boost, 10% progress
INSERT INTO frame_pack_loot_table (pack_id, reward_type, reward_value, weight, min_qty, max_qty) VALUES
('event', 'event_points',   '500',  50, 300, 700),
('event', 'coins',          '200',  25, 100, 300),
('event', 'event_boost',    '1.5',  15, 1, 1),
('event', 'event_progress', '1',    10, 1, 1);

-- ─── 12. RPC: COMPUTE FRAME PROGRESS ────────────────────────────

CREATE OR REPLACE FUNCTION compute_frame_progress(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_profile RECORD;
  v_frame RECORD;
  v_value INTEGER;
  v_target INTEGER;
  v_condition_type TEXT;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  FOR v_frame IN
    SELECT * FROM frame_definitions
    WHERE category IN ('prestige','event')
      AND is_active = true
  LOOP
    -- Determine condition type and target
    v_condition_type := COALESCE(
      v_frame.prestige_condition->>'type',
      v_frame.event_condition->>'type'
    );
    v_target := COALESCE(
      (v_frame.prestige_condition->>'target')::int,
      (v_frame.event_condition->>'target')::int,
      0
    );
    v_value := 0;

    CASE v_condition_type
      WHEN 'challenge_wins' THEN
        -- Crystal: total completed challenge wins
        v_value := COALESCE(v_profile.wins, 0);

      WHEN 'season_leaderboard_top' THEN
        -- Legend: check if user is in top N of any season leaderboard
        -- Simplified: use current level rank as proxy (real impl uses season snapshots)
        v_value := 0; -- Will be set by season-end logic

      WHEN 'challenges_created' THEN
        -- Icon: total completed challenges the user created
        SELECT COUNT(*) INTO v_value FROM bets
        WHERE creator_id = p_user_id AND status = 'completed';

      WHEN 'win_streak' THEN
        -- Hero: current win streak (or best ever)
        v_value := COALESCE(v_profile.streak, 0);

      WHEN 'founder_flag' THEN
        -- Founder: is_founder boolean
        v_value := CASE WHEN v_profile.is_founder THEN 1 ELSE 0 END;

      WHEN 'weekly_rank' THEN
        -- POTW: check current weekly leaderboard position
        -- Simplified: 0 by default, set by weekly leaderboard snapshot
        v_value := 0;

      WHEN 'event_challenges' THEN
        -- Futties: challenges completed during event
        -- Read from user_event_progress if event exists
        IF v_frame.event_id IS NOT NULL THEN
          SELECT COALESCE((progress->>'challenges_completed')::int, 0) INTO v_value
          FROM user_event_progress
          WHERE user_id = p_user_id AND event_id = v_frame.event_id;
        END IF;

      WHEN 'event_points' THEN
        -- Celestial: event points accumulated
        IF v_frame.event_id IS NOT NULL THEN
          SELECT COALESCE((progress->>'event_points')::int, 0) INTO v_value
          FROM user_event_progress
          WHERE user_id = p_user_id AND event_id = v_frame.event_id;
        END IF;

      WHEN 'event_multi' THEN
        -- Neon: multiple criteria (login_days + challenges)
        -- Use minimum of both progress ratios
        IF v_frame.event_id IS NOT NULL THEN
          DECLARE
            v_login_days INTEGER;
            v_challenges INTEGER;
            v_login_target INTEGER;
            v_challenge_target INTEGER;
          BEGIN
            SELECT
              COALESCE((progress->>'login_days')::int, 0),
              COALESCE((progress->>'challenges_completed')::int, 0)
            INTO v_login_days, v_challenges
            FROM user_event_progress
            WHERE user_id = p_user_id AND event_id = v_frame.event_id;

            v_login_target := COALESCE((v_frame.event_condition->'targets'->>'login_days')::int, 7);
            v_challenge_target := COALESCE((v_frame.event_condition->'targets'->>'challenges')::int, 3);

            -- Use combined progress as percentage
            v_value := LEAST(
              FLOOR((COALESCE(v_login_days,0)::decimal / v_login_target +
                     COALESCE(v_challenges,0)::decimal / v_challenge_target) / 2 * v_target),
              v_target
            );
          END;
        END IF;

      ELSE
        v_value := 0;
    END CASE;

    -- Upsert progress
    INSERT INTO user_frame_progress (user_id, frame_id, current_value, target_value, progress_pct, is_claimable, last_computed_at)
    VALUES (
      p_user_id,
      v_frame.id,
      v_value,
      v_target,
      CASE WHEN v_target > 0 THEN LEAST(100, (v_value::decimal / v_target) * 100) ELSE 0 END,
      v_value >= v_target AND v_target > 0,
      now()
    )
    ON CONFLICT (user_id, frame_id) DO UPDATE SET
      current_value = EXCLUDED.current_value,
      target_value = EXCLUDED.target_value,
      progress_pct = EXCLUDED.progress_pct,
      is_claimable = EXCLUDED.is_claimable,
      last_computed_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 13. TRIGGER: RECOMPUTE ON DEAL COMPLETE ────────────────────

CREATE OR REPLACE FUNCTION trg_recompute_frame_progress_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Recompute when wins or streak changes
  IF (OLD.wins IS DISTINCT FROM NEW.wins) OR (OLD.streak IS DISTINCT FROM NEW.streak) THEN
    PERFORM compute_frame_progress(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profile_frame_progress ON profiles;
CREATE TRIGGER trg_profile_frame_progress
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trg_recompute_frame_progress_profile();

-- ─── 14. DATA MIGRATION ─────────────────────────────────────────

-- Ensure bronze is unlocked for ALL existing users
INSERT INTO user_unlocked_items (user_id, item_type, item_code, unlocked_via)
SELECT id, 'frame', 'bronze', 'default' FROM profiles
ON CONFLICT (user_id, item_type, item_code) DO NOTHING;

-- Auto-unlock founder frame for all founder users
INSERT INTO user_unlocked_items (user_id, item_type, item_code, unlocked_via)
SELECT id, 'frame', 'founder', 'founder_grant' FROM profiles WHERE is_founder = true
ON CONFLICT (user_id, item_type, item_code) DO NOTHING;

-- Backfill frame progress for all existing users
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles LIMIT 500 LOOP
    PERFORM compute_frame_progress(r.id);
  END LOOP;
END;
$$;

-- ─── 15. UPDATE DAILY LOGIN REWARDS ─────────────────────────────

UPDATE daily_login_rewards SET reward_coins = 25  WHERE day_number = 1;
UPDATE daily_login_rewards SET reward_coins = 30  WHERE day_number = 2;
UPDATE daily_login_rewards SET reward_coins = 40  WHERE day_number = 3;
UPDATE daily_login_rewards SET reward_coins = 50  WHERE day_number = 4;
UPDATE daily_login_rewards SET reward_coins = 60  WHERE day_number = 5;
UPDATE daily_login_rewards SET reward_coins = 75  WHERE day_number = 6;
UPDATE daily_login_rewards SET reward_coins = 100 WHERE day_number = 7;

-- ═══════════════════════════════════════════════════════════════════
-- DONE — V11 Store Redesign Migration Complete
-- ═══════════════════════════════════════════════════════════════════
