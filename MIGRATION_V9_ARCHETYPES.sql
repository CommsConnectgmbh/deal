-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V9: Archetype Shop + Card Collection System
--
-- Adds: archetype column to card_catalog, archetype_shop_items,
--        user_owned_archetypes, age column, new RPC functions
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- 1. SCHEMA CHANGES
-- ═══════════════════════════════════════

-- 1.1 Add archetype + age to card_catalog
ALTER TABLE card_catalog ADD COLUMN IF NOT EXISTS archetype TEXT;
ALTER TABLE card_catalog ADD COLUMN IF NOT EXISTS age TEXT DEFAULT 'young';

-- Index for fast archetype lookups
CREATE INDEX IF NOT EXISTS idx_card_catalog_archetype ON card_catalog(archetype);
CREATE INDEX IF NOT EXISTS idx_card_catalog_arch_frame ON card_catalog(archetype, frame, gender, age, origin, hair);

-- 1.2 Add age to user_avatar_dna
ALTER TABLE user_avatar_dna ADD COLUMN IF NOT EXISTS age TEXT DEFAULT 'young';

-- 1.3 Archetype Shop Items
CREATE TABLE IF NOT EXISTS archetype_shop_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_emoji TEXT NOT NULL,
  icon_image_url TEXT,
  price_coins INTEGER NOT NULL DEFAULT 500,
  rarity TEXT DEFAULT 'epic',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE archetype_shop_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "archetype_shop_items_public_read" ON archetype_shop_items;
CREATE POLICY "archetype_shop_items_public_read" ON archetype_shop_items
  FOR SELECT USING (true);

-- 1.4 User Owned Archetypes (purchased licenses)
CREATE TABLE IF NOT EXISTS user_owned_archetypes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  archetype TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, archetype)
);

ALTER TABLE user_owned_archetypes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_owned_archetypes_own" ON user_owned_archetypes;
CREATE POLICY "user_owned_archetypes_own" ON user_owned_archetypes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_owned_archetypes_service" ON user_owned_archetypes;
CREATE POLICY "user_owned_archetypes_service" ON user_owned_archetypes
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════
-- 2. SEED ARCHETYPE SHOP ITEMS
-- ═══════════════════════════════════════

INSERT INTO archetype_shop_items (id, name, description, icon_emoji, price_coins, rarity, sort_order) VALUES
  ('founder',    'The Founder',    'Baut Imperien aus dem Nichts. Visionaer, unerschrocken, ein geborener Anfuehrer.',    '🏗️', 500, 'epic', 1),
  ('trader',     'The Trader',     'Meister der Maerkte. Liest Charts wie andere Buecher lesen.',                          '📊', 500, 'epic', 2),
  ('hacker',     'The Hacker',     'Digitaler Architekt. Baut die Zukunft mit Code und Koffein.',                          '💻', 500, 'epic', 3),
  ('visionary',  'The Visionary',  'Sieht was andere nicht sehen. Traeume werden zu Strategien.',                          '🔮', 500, 'epic', 4),
  ('strategist', 'The Strategist', 'Taktiker im Schatten. Drei Zuege voraus, immer.',                                     '♟️', 500, 'epic', 5),
  ('hustler',    'The Hustler',    'Strassenkampf-Mentalitaet. Gibt nie auf, findet immer einen Weg.',                     '💰', 500, 'epic', 6),
  ('maverick',   'The Maverick',   'Der Regelbrecher. Macht seine eigenen Regeln und gewinnt.',                            '🎯', 500, 'epic', 7),
  ('titan',      'The Titan',      'Unaufhaltsame Kraft. Dominiert jedes Feld, das er betritt.',                           '⚡', 500, 'epic', 8)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_emoji = EXCLUDED.icon_emoji,
  price_coins = EXCLUDED.price_coins,
  rarity = EXCLUDED.rarity,
  sort_order = EXCLUDED.sort_order;

-- ═══════════════════════════════════════
-- 3. UPDATED RPC FUNCTIONS
-- ═══════════════════════════════════════

-- 3.1 FIND BEST MATCHING CARD (v2 — with archetype + age support)
CREATE OR REPLACE FUNCTION find_best_matching_card(
  p_frame TEXT,
  p_gender TEXT,
  p_origin TEXT,
  p_hair TEXT,
  p_style TEXT,
  p_accessory TEXT,
  p_effect TEXT,
  p_archetype TEXT DEFAULT NULL,
  p_age TEXT DEFAULT 'young'
) RETURNS UUID AS $$
DECLARE
  v_card_id UUID;
BEGIN
  -- 1. Exact match: archetype + frame + gender + age + origin + hair
  SELECT id INTO v_card_id
  FROM card_catalog
  WHERE frame = p_frame
    AND ((p_archetype IS NULL AND archetype IS NULL) OR archetype = p_archetype)
    AND gender = p_gender
    AND age = p_age
    AND origin = p_origin
    AND hair = p_hair
    AND is_claimed = false
    AND is_available = true
  LIMIT 1;

  IF v_card_id IS NOT NULL THEN RETURN v_card_id; END IF;

  -- 2. Fallback: archetype + frame + gender + origin + hair (ignore age)
  SELECT id INTO v_card_id
  FROM card_catalog
  WHERE frame = p_frame
    AND ((p_archetype IS NULL AND archetype IS NULL) OR archetype = p_archetype)
    AND gender = p_gender
    AND origin = p_origin
    AND hair = p_hair
    AND is_claimed = false
    AND is_available = true
  LIMIT 1;

  IF v_card_id IS NOT NULL THEN RETURN v_card_id; END IF;

  -- 3. Fallback: archetype + frame + gender + origin
  SELECT id INTO v_card_id
  FROM card_catalog
  WHERE frame = p_frame
    AND ((p_archetype IS NULL AND archetype IS NULL) OR archetype = p_archetype)
    AND gender = p_gender
    AND origin = p_origin
    AND is_claimed = false
    AND is_available = true
  LIMIT 1;

  IF v_card_id IS NOT NULL THEN RETURN v_card_id; END IF;

  -- 4. Fallback: archetype + frame + gender
  SELECT id INTO v_card_id
  FROM card_catalog
  WHERE frame = p_frame
    AND ((p_archetype IS NULL AND archetype IS NULL) OR archetype = p_archetype)
    AND gender = p_gender
    AND is_claimed = false
    AND is_available = true
  LIMIT 1;

  IF v_card_id IS NOT NULL THEN RETURN v_card_id; END IF;

  -- 5. Last resort: archetype + frame (any gender/attributes)
  SELECT id INTO v_card_id
  FROM card_catalog
  WHERE frame = p_frame
    AND ((p_archetype IS NULL AND archetype IS NULL) OR archetype = p_archetype)
    AND is_claimed = false
    AND is_available = true
  LIMIT 1;

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.2 ASSIGN STARTER CARD (v2 — with age parameter)
CREATE OR REPLACE FUNCTION assign_starter_card(
  p_user_id UUID,
  p_gender TEXT,
  p_origin TEXT,
  p_hair TEXT,
  p_style TEXT,
  p_age TEXT DEFAULT 'young'
) RETURNS UUID AS $$
DECLARE
  v_card_id UUID;
BEGIN
  -- 1. DNA speichern (with age)
  INSERT INTO user_avatar_dna (user_id, gender, origin, hair, style, age)
  VALUES (p_user_id, p_gender, p_origin, p_hair, p_style, p_age)
  ON CONFLICT (user_id) DO UPDATE SET
    gender = p_gender, origin = p_origin,
    hair = p_hair, style = p_style, age = p_age,
    updated_at = now();

  -- 2. Start-Items freischalten
  INSERT INTO user_unlocked_items (user_id, item_type, item_code, unlocked_via)
  VALUES
    (p_user_id, 'accessory', 'none', 'free'),
    (p_user_id, 'effect', 'none', 'free'),
    (p_user_id, 'frame', 'bronze', 'free')
  ON CONFLICT DO NOTHING;

  -- 3. Passende Bronze BASE Karte finden (archetype = NULL for base cards)
  v_card_id := find_best_matching_card(
    'bronze', p_gender, p_origin, p_hair, p_style, 'none', 'none', NULL, p_age
  );

  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'Keine Bronze-Karte verfuegbar';
  END IF;

  -- 4. Karte als claimed markieren
  UPDATE card_catalog SET is_claimed = true WHERE id = v_card_id;

  -- 5. Alte equipped Karte abwaehlen
  UPDATE user_cards SET is_equipped = false
  WHERE user_id = p_user_id AND is_equipped = true;

  -- 6. Neue Karte zuweisen
  INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
  VALUES (p_user_id, v_card_id, true, 'registration');

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.3 UPGRADE USER CARD (v2 — with archetype + age awareness)
CREATE OR REPLACE FUNCTION upgrade_user_card(
  p_user_id UUID,
  p_item_type TEXT,
  p_item_code TEXT
) RETURNS UUID AS $$
DECLARE
  v_dna RECORD;
  v_new_accessory TEXT;
  v_new_effect TEXT;
  v_new_frame TEXT;
  v_card_id UUID;
  v_current_archetype TEXT;
BEGIN
  -- 1. DNA laden
  SELECT * INTO v_dna FROM user_avatar_dna WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User hat keine Avatar DNA';
  END IF;

  -- 2. Current equipped card's archetype ermitteln
  SELECT cc.archetype INTO v_current_archetype
  FROM user_cards uc
  JOIN card_catalog cc ON cc.id = uc.card_id
  WHERE uc.user_id = p_user_id AND uc.is_equipped = true;

  -- 3. Neue Werte bestimmen
  v_new_accessory := v_dna.current_accessory;
  v_new_effect := v_dna.current_effect;
  v_new_frame := v_dna.current_frame;

  IF p_item_type = 'accessory' THEN v_new_accessory := p_item_code; END IF;
  IF p_item_type = 'effect' THEN v_new_effect := p_item_code; END IF;
  IF p_item_type = 'frame' THEN v_new_frame := p_item_code; END IF;

  -- 4. Item freischalten
  INSERT INTO user_unlocked_items (user_id, item_type, item_code, unlocked_via)
  VALUES (p_user_id, p_item_type, p_item_code, 'coins')
  ON CONFLICT DO NOTHING;

  -- 5. Passende neue Karte finden (preserve archetype!)
  v_card_id := find_best_matching_card(
    v_new_frame, v_dna.gender, v_dna.origin, v_dna.hair, v_dna.style,
    v_new_accessory, v_new_effect, v_current_archetype, COALESCE(v_dna.age, 'young')
  );

  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'Keine passende Karte verfuegbar fuer Frame: %', v_new_frame;
  END IF;

  -- 6. Alte Karte: is_equipped = false (BLEIBT in Sammlung!)
  UPDATE user_cards SET is_equipped = false
  WHERE user_id = p_user_id AND is_equipped = true;

  -- 7. Neue Karte zuweisen
  UPDATE card_catalog SET is_claimed = true WHERE id = v_card_id;
  INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
  VALUES (p_user_id, v_card_id, true, 'upgrade');

  -- 8. DNA updaten
  UPDATE user_avatar_dna SET
    current_accessory = v_new_accessory,
    current_effect = v_new_effect,
    current_frame = v_new_frame,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.4 PURCHASE ARCHETYPE CARD (NEW)
CREATE OR REPLACE FUNCTION purchase_archetype_card(
  p_user_id UUID,
  p_archetype TEXT
) RETURNS UUID AS $$
DECLARE
  v_price INTEGER;
  v_coins INTEGER;
  v_dna RECORD;
  v_card_id UUID;
  v_already_owned BOOLEAN;
BEGIN
  -- 1. Check archetype exists and is active
  SELECT price_coins INTO v_price
  FROM archetype_shop_items
  WHERE id = p_archetype AND is_active = true;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Archetype nicht verfuegbar: %', p_archetype;
  END IF;

  -- 2. Check not already owned
  SELECT EXISTS(
    SELECT 1 FROM user_owned_archetypes
    WHERE user_id = p_user_id AND archetype = p_archetype
  ) INTO v_already_owned;

  IF v_already_owned THEN
    RAISE EXCEPTION 'Archetype bereits gekauft: %', p_archetype;
  END IF;

  -- 3. Load user DNA
  SELECT * INTO v_dna FROM user_avatar_dna WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Erstelle zuerst deinen Avatar';
  END IF;

  -- 4. Check coins
  SELECT coins INTO v_coins FROM profiles WHERE id = p_user_id;
  IF v_coins < v_price THEN
    RAISE EXCEPTION 'Nicht genug Coins (hast: %, brauchst: %)', v_coins, v_price;
  END IF;

  -- 5. Deduct coins
  PERFORM deduct_coins(p_user_id, v_price);

  -- 6. Wallet ledger
  INSERT INTO wallet_ledger (user_id, delta, reason, reference_id)
  VALUES (p_user_id, -v_price, 'archetype_purchase', p_archetype);

  -- 7. Grant archetype license
  INSERT INTO user_owned_archetypes (user_id, archetype)
  VALUES (p_user_id, p_archetype);

  -- 8. Find matching archetype card (use current frame)
  v_card_id := find_best_matching_card(
    COALESCE(v_dna.current_frame, 'bronze'),
    v_dna.gender, v_dna.origin, v_dna.hair,
    COALESCE(v_dna.style, 'default'),
    COALESCE(v_dna.current_accessory, 'none'),
    COALESCE(v_dna.current_effect, 'none'),
    p_archetype,
    COALESCE(v_dna.age, 'young')
  );

  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'Keine passende Karte fuer Archetype: %', p_archetype;
  END IF;

  -- 9. Claim card
  UPDATE card_catalog SET is_claimed = true WHERE id = v_card_id;

  -- 10. Unequip old card
  UPDATE user_cards SET is_equipped = false
  WHERE user_id = p_user_id AND is_equipped = true;

  -- 11. Assign new card
  INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
  VALUES (p_user_id, v_card_id, true, 'shop');

  -- 12. Update equipped card image on profile
  UPDATE profiles SET equipped_card_image_url = (
    SELECT image_url FROM card_catalog WHERE id = v_card_id
  ) WHERE id = p_user_id;

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.5 USE REFRESH CARD / AVATAR RESET (NEW)
CREATE OR REPLACE FUNCTION use_refresh_card(
  p_user_id UUID,
  p_gender TEXT,
  p_age TEXT,
  p_origin TEXT,
  p_hair TEXT
) RETURNS UUID AS $$
DECLARE
  v_refresh_price INTEGER := 1000;
  v_coins INTEGER;
  v_dna RECORD;
  v_card_id UUID;
  v_arch RECORD;
  v_arch_card_id UUID;
BEGIN
  -- 1. Check coins
  SELECT coins INTO v_coins FROM profiles WHERE id = p_user_id;
  IF v_coins < v_refresh_price THEN
    RAISE EXCEPTION 'Nicht genug Coins fuer Avatar Reset (brauchst: %)', v_refresh_price;
  END IF;

  -- 2. Deduct coins
  PERFORM deduct_coins(p_user_id, v_refresh_price);

  INSERT INTO wallet_ledger (user_id, delta, reason, reference_id)
  VALUES (p_user_id, -v_refresh_price, 'avatar_reset', 'refresh_card');

  -- 3. Load current DNA for frame info
  SELECT * INTO v_dna FROM user_avatar_dna WHERE user_id = p_user_id;

  -- 4. Update DNA with new values (keep current frame/accessory/effect)
  UPDATE user_avatar_dna SET
    gender = p_gender,
    age = p_age,
    origin = p_origin,
    hair = p_hair,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- 5. Unequip all cards (old cards stay in collection!)
  UPDATE user_cards SET is_equipped = false
  WHERE user_id = p_user_id AND is_equipped = true;

  -- 6. Find new BASE card with new DNA
  v_card_id := find_best_matching_card(
    COALESCE(v_dna.current_frame, 'bronze'),
    p_gender, p_origin, p_hair,
    COALESCE(v_dna.style, 'default'),
    COALESCE(v_dna.current_accessory, 'none'),
    COALESCE(v_dna.current_effect, 'none'),
    NULL,  -- archetype = NULL for BASE
    p_age
  );

  IF v_card_id IS NOT NULL THEN
    UPDATE card_catalog SET is_claimed = true WHERE id = v_card_id;
    INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
    VALUES (p_user_id, v_card_id, true, 'avatar_reset');
  END IF;

  -- 7. Re-claim cards for all owned archetypes with new DNA
  FOR v_arch IN SELECT archetype FROM user_owned_archetypes WHERE user_id = p_user_id
  LOOP
    v_arch_card_id := find_best_matching_card(
      COALESCE(v_dna.current_frame, 'bronze'),
      p_gender, p_origin, p_hair,
      COALESCE(v_dna.style, 'default'),
      COALESCE(v_dna.current_accessory, 'none'),
      COALESCE(v_dna.current_effect, 'none'),
      v_arch.archetype,
      p_age
    );

    IF v_arch_card_id IS NOT NULL THEN
      UPDATE card_catalog SET is_claimed = true WHERE id = v_arch_card_id;
      INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
      VALUES (p_user_id, v_arch_card_id, false, 'avatar_reset');
    END IF;
  END LOOP;

  -- 8. Update profile equipped card image
  IF v_card_id IS NOT NULL THEN
    UPDATE profiles SET equipped_card_image_url = (
      SELECT image_url FROM card_catalog WHERE id = v_card_id
    ) WHERE id = p_user_id;
  END IF;

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════
-- 4. GRANT PERMISSIONS
-- ═══════════════════════════════════════

GRANT SELECT ON archetype_shop_items TO anon, authenticated;
GRANT SELECT ON user_owned_archetypes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON user_owned_archetypes TO service_role;
GRANT EXECUTE ON FUNCTION purchase_archetype_card TO authenticated;
GRANT EXECUTE ON FUNCTION use_refresh_card TO authenticated;

-- Done!
-- Next: Run upload-cards-to-supabase.js to upload images
-- Then: Run seed-card-catalog.js to populate card_catalog
