-- ============================================================
-- DealBuddy MIGRATION V16 – Fix search_path on ALL RPC functions
-- Run in Supabase SQL Editor
--
-- ROOT CAUSE: All SECURITY DEFINER functions from V9 + V12 were
-- created WITHOUT "SET search_path = public". When called via
-- PostgREST, they cannot find tables → "relation does not exist".
-- ============================================================

-- ─── 1. Fix add_coins (from V12) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION add_coins(p_user_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  UPDATE profiles SET coins = coins + p_amount WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── 2. Fix deduct_coins (from V12) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION deduct_coins(p_user_id UUID, p_amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  UPDATE profiles
  SET coins = coins - p_amount
  WHERE id = p_user_id AND coins >= p_amount
  RETURNING coins INTO v_new_balance;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── 3. Fix find_best_matching_card (from V9) ──────────────────────────────────
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
  -- 1. Exact match
  SELECT id INTO v_card_id FROM card_catalog
  WHERE frame = p_frame
    AND ((p_archetype IS NULL AND archetype IS NULL) OR archetype = p_archetype)
    AND gender = p_gender AND age = p_age AND origin = p_origin AND hair = p_hair
    AND is_claimed = false AND is_available = true
  LIMIT 1;
  IF v_card_id IS NOT NULL THEN RETURN v_card_id; END IF;

  -- 2. Ignore age
  SELECT id INTO v_card_id FROM card_catalog
  WHERE frame = p_frame
    AND ((p_archetype IS NULL AND archetype IS NULL) OR archetype = p_archetype)
    AND gender = p_gender AND origin = p_origin AND hair = p_hair
    AND is_claimed = false AND is_available = true
  LIMIT 1;
  IF v_card_id IS NOT NULL THEN RETURN v_card_id; END IF;

  -- 3. Ignore hair
  SELECT id INTO v_card_id FROM card_catalog
  WHERE frame = p_frame
    AND ((p_archetype IS NULL AND archetype IS NULL) OR archetype = p_archetype)
    AND gender = p_gender AND origin = p_origin
    AND is_claimed = false AND is_available = true
  LIMIT 1;
  IF v_card_id IS NOT NULL THEN RETURN v_card_id; END IF;

  -- 4. Just frame + gender
  SELECT id INTO v_card_id FROM card_catalog
  WHERE frame = p_frame
    AND ((p_archetype IS NULL AND archetype IS NULL) OR archetype = p_archetype)
    AND gender = p_gender
    AND is_claimed = false AND is_available = true
  LIMIT 1;
  IF v_card_id IS NOT NULL THEN RETURN v_card_id; END IF;

  -- 5. Last resort: frame only
  SELECT id INTO v_card_id FROM card_catalog
  WHERE frame = p_frame
    AND ((p_archetype IS NULL AND archetype IS NULL) OR archetype = p_archetype)
    AND is_claimed = false AND is_available = true
  LIMIT 1;
  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── 4. Fix assign_starter_card (from V9) ──────────────────────────────────────
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
  INSERT INTO user_avatar_dna (user_id, gender, origin, hair, style, age)
  VALUES (p_user_id, p_gender, p_origin, p_hair, p_style, p_age)
  ON CONFLICT (user_id) DO UPDATE SET
    gender = p_gender, origin = p_origin,
    hair = p_hair, style = p_style, age = p_age,
    updated_at = now();

  INSERT INTO user_unlocked_items (user_id, item_type, item_code, unlocked_via)
  VALUES
    (p_user_id, 'accessory', 'none', 'free'),
    (p_user_id, 'effect', 'none', 'free'),
    (p_user_id, 'frame', 'bronze', 'free')
  ON CONFLICT DO NOTHING;

  v_card_id := find_best_matching_card(
    'bronze', p_gender, p_origin, p_hair, p_style, 'none', 'none', NULL, p_age
  );

  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'Keine Bronze-Karte verfuegbar';
  END IF;

  UPDATE card_catalog SET is_claimed = true WHERE id = v_card_id;
  UPDATE user_cards SET is_equipped = false WHERE user_id = p_user_id AND is_equipped = true;
  INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
  VALUES (p_user_id, v_card_id, true, 'registration');

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── 5. Fix upgrade_user_card (from V9) ────────────────────────────────────────
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
  SELECT * INTO v_dna FROM user_avatar_dna WHERE user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User hat keine Avatar DNA'; END IF;

  SELECT cc.archetype INTO v_current_archetype
  FROM user_cards uc JOIN card_catalog cc ON cc.id = uc.card_id
  WHERE uc.user_id = p_user_id AND uc.is_equipped = true;

  v_new_accessory := v_dna.current_accessory;
  v_new_effect := v_dna.current_effect;
  v_new_frame := v_dna.current_frame;

  IF p_item_type = 'accessory' THEN v_new_accessory := p_item_code; END IF;
  IF p_item_type = 'effect' THEN v_new_effect := p_item_code; END IF;
  IF p_item_type = 'frame' THEN v_new_frame := p_item_code; END IF;

  INSERT INTO user_unlocked_items (user_id, item_type, item_code, unlocked_via)
  VALUES (p_user_id, p_item_type, p_item_code, 'coins')
  ON CONFLICT DO NOTHING;

  v_card_id := find_best_matching_card(
    v_new_frame, v_dna.gender, v_dna.origin, v_dna.hair, v_dna.style,
    v_new_accessory, v_new_effect, v_current_archetype, COALESCE(v_dna.age, 'young')
  );

  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'Keine passende Karte verfuegbar fuer Frame: %', v_new_frame;
  END IF;

  UPDATE user_cards SET is_equipped = false WHERE user_id = p_user_id AND is_equipped = true;
  UPDATE card_catalog SET is_claimed = true WHERE id = v_card_id;
  INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
  VALUES (p_user_id, v_card_id, true, 'upgrade');

  UPDATE user_avatar_dna SET
    current_accessory = v_new_accessory,
    current_effect = v_new_effect,
    current_frame = v_new_frame,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── 6. Fix purchase_archetype_card (from V9) ──────────────────────────────────
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
  SELECT price_coins INTO v_price
  FROM archetype_shop_items
  WHERE id = p_archetype AND is_active = true;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Archetype nicht verfuegbar: %', p_archetype;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM user_owned_archetypes
    WHERE user_id = p_user_id AND archetype = p_archetype
  ) INTO v_already_owned;
  IF v_already_owned THEN
    RAISE EXCEPTION 'Archetype bereits gekauft: %', p_archetype;
  END IF;

  SELECT * INTO v_dna FROM user_avatar_dna WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Erstelle zuerst deinen Avatar';
  END IF;

  SELECT coins INTO v_coins FROM profiles WHERE id = p_user_id;
  IF v_coins < v_price THEN
    RAISE EXCEPTION 'Nicht genug Coins (hast: %, brauchst: %)', v_coins, v_price;
  END IF;

  PERFORM deduct_coins(p_user_id, v_price);

  INSERT INTO wallet_ledger (user_id, delta, reason, reference_id)
  VALUES (p_user_id, -v_price, 'archetype_purchase', p_archetype);

  INSERT INTO user_owned_archetypes (user_id, archetype)
  VALUES (p_user_id, p_archetype);

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

  UPDATE card_catalog SET is_claimed = true WHERE id = v_card_id;
  UPDATE user_cards SET is_equipped = false WHERE user_id = p_user_id AND is_equipped = true;
  INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
  VALUES (p_user_id, v_card_id, true, 'shop');

  UPDATE profiles SET equipped_card_image_url = (
    SELECT image_url FROM card_catalog WHERE id = v_card_id
  ) WHERE id = p_user_id;

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── 7. Fix use_refresh_card (from V9) ─────────────────────────────────────────
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
  SELECT coins INTO v_coins FROM profiles WHERE id = p_user_id;
  IF v_coins < v_refresh_price THEN
    RAISE EXCEPTION 'Nicht genug Coins fuer Avatar Reset (brauchst: %)', v_refresh_price;
  END IF;

  PERFORM deduct_coins(p_user_id, v_refresh_price);
  INSERT INTO wallet_ledger (user_id, delta, reason, reference_id)
  VALUES (p_user_id, -v_refresh_price, 'avatar_reset', 'refresh_card');

  SELECT * INTO v_dna FROM user_avatar_dna WHERE user_id = p_user_id;

  UPDATE user_avatar_dna SET
    gender = p_gender, age = p_age, origin = p_origin, hair = p_hair, updated_at = now()
  WHERE user_id = p_user_id;

  UPDATE user_cards SET is_equipped = false WHERE user_id = p_user_id AND is_equipped = true;

  v_card_id := find_best_matching_card(
    COALESCE(v_dna.current_frame, 'bronze'),
    p_gender, p_origin, p_hair,
    COALESCE(v_dna.style, 'default'),
    COALESCE(v_dna.current_accessory, 'none'),
    COALESCE(v_dna.current_effect, 'none'),
    NULL, p_age
  );

  IF v_card_id IS NOT NULL THEN
    UPDATE card_catalog SET is_claimed = true WHERE id = v_card_id;
    INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
    VALUES (p_user_id, v_card_id, true, 'avatar_reset');
  END IF;

  FOR v_arch IN SELECT archetype FROM user_owned_archetypes WHERE user_id = p_user_id
  LOOP
    v_arch_card_id := find_best_matching_card(
      COALESCE(v_dna.current_frame, 'bronze'),
      p_gender, p_origin, p_hair,
      COALESCE(v_dna.style, 'default'),
      COALESCE(v_dna.current_accessory, 'none'),
      COALESCE(v_dna.current_effect, 'none'),
      v_arch.archetype, p_age
    );
    IF v_arch_card_id IS NOT NULL THEN
      UPDATE card_catalog SET is_claimed = true WHERE id = v_arch_card_id;
      INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
      VALUES (p_user_id, v_arch_card_id, false, 'avatar_reset');
    END IF;
  END LOOP;

  IF v_card_id IS NOT NULL THEN
    UPDATE profiles SET equipped_card_image_url = (
      SELECT image_url FROM card_catalog WHERE id = v_card_id
    ) WHERE id = p_user_id;
  END IF;

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── 8. Re-grant permissions ────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION add_coins(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION deduct_coins(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION find_best_matching_card(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION assign_starter_card(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION upgrade_user_card(UUID,TEXT,TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION purchase_archetype_card(UUID,TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION use_refresh_card(UUID,TEXT,TEXT,TEXT,TEXT) TO authenticated, service_role;

-- ─── Done ───────────────────────────────────────────────────────────────────────
-- All 7 functions now have SET search_path = public
-- Archetype purchase, card equip, avatar reset should all work now
