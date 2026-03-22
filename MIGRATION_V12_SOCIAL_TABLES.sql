-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V12: Social Tables + Follow Fix + Card Assignment
-- Creates missing social interaction tables (deal_likes, deal_comments,
-- deal_reposts, feed_events) and fixes follows RLS policies.
-- Also adds auto-card-assignment on frame purchase.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- 1. DEAL LIKES
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS deal_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_likes_deal ON deal_likes(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_likes_user ON deal_likes(user_id);

ALTER TABLE deal_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal_likes_read" ON deal_likes;
CREATE POLICY "deal_likes_read" ON deal_likes
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "deal_likes_insert" ON deal_likes;
CREATE POLICY "deal_likes_insert" ON deal_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "deal_likes_delete" ON deal_likes;
CREATE POLICY "deal_likes_delete" ON deal_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- 2. DEAL COMMENTS
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS deal_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_comments_deal ON deal_comments(deal_id);

ALTER TABLE deal_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal_comments_read" ON deal_comments;
CREATE POLICY "deal_comments_read" ON deal_comments
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "deal_comments_insert" ON deal_comments;
CREATE POLICY "deal_comments_insert" ON deal_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "deal_comments_delete" ON deal_comments;
CREATE POLICY "deal_comments_delete" ON deal_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- 3. DEAL REPOSTS
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS deal_reposts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_deal_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(original_deal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_reposts_deal ON deal_reposts(original_deal_id);

ALTER TABLE deal_reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal_reposts_read" ON deal_reposts;
CREATE POLICY "deal_reposts_read" ON deal_reposts
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "deal_reposts_insert" ON deal_reposts;
CREATE POLICY "deal_reposts_insert" ON deal_reposts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "deal_reposts_delete" ON deal_reposts;
CREATE POLICY "deal_reposts_delete" ON deal_reposts
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- 4. FEED EVENTS (Stories)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS feed_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_events_user ON feed_events(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_events_type ON feed_events(event_type);

ALTER TABLE feed_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_events_read" ON feed_events;
CREATE POLICY "feed_events_read" ON feed_events
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "feed_events_insert" ON feed_events;
CREATE POLICY "feed_events_insert" ON feed_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- 5. FIX FOLLOWS RLS — Clean up V2 + V4 policy conflicts
-- ═══════════════════════════════════════

-- Drop ALL old policies (V2 names + V4 names)
DROP POLICY IF EXISTS "Follows: read own" ON follows;
DROP POLICY IF EXISTS "Follows: insert own" ON follows;
DROP POLICY IF EXISTS "Follows: update target" ON follows;
DROP POLICY IF EXISTS "Follows: delete own" ON follows;
DROP POLICY IF EXISTS "users see all follows" ON follows;
DROP POLICY IF EXISTS "users manage own follows" ON follows;

-- Clean, simple policies
CREATE POLICY "follows_select_all" ON follows
  FOR SELECT USING (TRUE);

CREATE POLICY "follows_insert_own" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_update_own" ON follows
  FOR UPDATE USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "follows_delete_own" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ═══════════════════════════════════════
-- 6. DEAL REPORTS (Melden-Funktion)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS deal_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deal_id, reporter_id)
);

ALTER TABLE deal_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal_reports_insert" ON deal_reports;
CREATE POLICY "deal_reports_insert" ON deal_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "deal_reports_read_own" ON deal_reports;
CREATE POLICY "deal_reports_read_own" ON deal_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- ═══════════════════════════════════════
-- 7. HIDDEN DEALS (Verbergen-Funktion)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS hidden_deals (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, deal_id)
);

ALTER TABLE hidden_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hidden_deals_manage" ON hidden_deals;
CREATE POLICY "hidden_deals_manage" ON hidden_deals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- 8. Auto-assign card on frame purchase
-- Function that creates a card_catalog entry + user_cards entry
-- ═══════════════════════════════════════
CREATE OR REPLACE FUNCTION assign_card_for_frame(
  p_user_id UUID,
  p_frame TEXT,
  p_obtained_from TEXT DEFAULT 'shop'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_card_id UUID;
  v_user_card_id UUID;
  v_gender TEXT;
  v_origin TEXT;
  v_hair TEXT;
  v_style TEXT;
  v_rarity TEXT;
  v_serial INT;
  v_serial_display TEXT;
  v_card_code TEXT;
  v_avatar_url TEXT;
BEGIN
  -- Get user's avatar DNA if exists, otherwise defaults
  SELECT gender, origin, hair, style INTO v_gender, v_origin, v_hair, v_style
  FROM user_avatar_dna WHERE user_id = p_user_id;

  IF v_gender IS NULL THEN
    v_gender := 'male';
    v_origin := 'european';
    v_hair := 'short';
    v_style := 'business_suit';
  END IF;

  -- Map frame to rarity
  v_rarity := CASE
    WHEN p_frame IN ('bronze','silver') THEN 'common'
    WHEN p_frame = 'gold' THEN 'rare'
    WHEN p_frame IN ('emerald','sapphire','ruby','amethyst','topaz') THEN 'epic'
    WHEN p_frame IN ('obsidian','legend','icon','hero','crystal') THEN 'legendary'
    WHEN p_frame = 'founder' THEN 'founder'
    WHEN p_frame IN ('futties','neon','celestial','player_of_the_week') THEN 'event'
    ELSE 'common'
  END;

  -- Get next serial number for this frame
  SELECT COALESCE(MAX(serial_number), 0) + 1 INTO v_serial
  FROM card_catalog WHERE frame = p_frame;

  v_serial_display := '#' || LPAD(v_serial::TEXT, 3, '0');
  v_card_code := UPPER(p_frame) || '-' || UPPER(v_gender) || '-' || UPPER(LEFT(v_origin, 3)) || '-' || v_serial;

  -- Get user's avatar_url for the card image
  SELECT avatar_url INTO v_avatar_url FROM profiles WHERE id = p_user_id;

  -- Create card in catalog
  INSERT INTO card_catalog (
    frame, rarity, gender, origin, hair, style,
    accessory, effect, card_code, serial_number, serial_display,
    image_url, is_claimed, is_available, season
  ) VALUES (
    p_frame, v_rarity, v_gender, v_origin, v_hair, v_style,
    'none', 'none', v_card_code, v_serial, v_serial_display,
    v_avatar_url, TRUE, FALSE, 'season_1'
  ) RETURNING id INTO v_card_id;

  -- Un-equip any currently equipped card
  UPDATE user_cards SET is_equipped = FALSE
  WHERE user_id = p_user_id AND is_equipped = TRUE;

  -- Assign card to user
  INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
  VALUES (p_user_id, v_card_id, TRUE, p_obtained_from)
  RETURNING id INTO v_user_card_id;

  RETURN v_card_id;
END;
$$;

-- ═══════════════════════════════════════
-- DONE — Run this in Supabase SQL Editor
-- ═══════════════════════════════════════
