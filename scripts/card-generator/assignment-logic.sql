-- ═══════════════════════════════════════════════════════════════
-- ASSIGNMENT LOGIC: Stored Functions für Karten-Zuordnung
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- 1. FIND BEST MATCHING CARD
--    Sucht die beste verfügbare Karte mit Fallback-Logik
-- ═══════════════════════════════════════
CREATE OR REPLACE FUNCTION find_best_matching_card(
  p_frame TEXT,
  p_gender TEXT,
  p_origin TEXT,
  p_hair TEXT,
  p_style TEXT,
  p_accessory TEXT,
  p_effect TEXT
) RETURNS UUID AS $$
DECLARE
  v_card_id UUID;
BEGIN
  -- 1. Exakte Übereinstimmung
  SELECT id INTO v_card_id
  FROM card_catalog
  WHERE frame = p_frame
    AND gender = p_gender
    AND origin = p_origin
    AND hair = p_hair
    AND style = p_style
    AND accessory = p_accessory
    AND effect = p_effect
    AND is_claimed = false
    AND is_available = true
  LIMIT 1;

  IF v_card_id IS NOT NULL THEN RETURN v_card_id; END IF;

  -- 2. Fallback: Frame + Gender + Origin + Hair + Style
  SELECT id INTO v_card_id
  FROM card_catalog
  WHERE frame = p_frame
    AND gender = p_gender
    AND origin = p_origin
    AND hair = p_hair
    AND style = p_style
    AND is_claimed = false
    AND is_available = true
  LIMIT 1;

  IF v_card_id IS NOT NULL THEN RETURN v_card_id; END IF;

  -- 3. Fallback: Frame + Gender + Origin
  SELECT id INTO v_card_id
  FROM card_catalog
  WHERE frame = p_frame
    AND gender = p_gender
    AND origin = p_origin
    AND is_claimed = false
    AND is_available = true
  LIMIT 1;

  IF v_card_id IS NOT NULL THEN RETURN v_card_id; END IF;

  -- 4. Letzter Fallback: Frame + Gender
  SELECT id INTO v_card_id
  FROM card_catalog
  WHERE frame = p_frame
    AND gender = p_gender
    AND is_claimed = false
    AND is_available = true
  LIMIT 1;

  IF v_card_id IS NOT NULL THEN RETURN v_card_id; END IF;

  -- 5. Absoluter Fallback: Irgendeine Karte mit diesem Frame
  SELECT id INTO v_card_id
  FROM card_catalog
  WHERE frame = p_frame
    AND is_claimed = false
    AND is_available = true
  LIMIT 1;

  RETURN v_card_id; -- kann NULL sein wenn keine Karten mehr
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════
-- 2. ASSIGN STARTER CARD (bei Registration)
-- ═══════════════════════════════════════
CREATE OR REPLACE FUNCTION assign_starter_card(
  p_user_id UUID,
  p_gender TEXT,
  p_origin TEXT,
  p_hair TEXT,
  p_style TEXT
) RETURNS UUID AS $$
DECLARE
  v_card_id UUID;
BEGIN
  -- 1. DNA speichern
  INSERT INTO user_avatar_dna (user_id, gender, origin, hair, style)
  VALUES (p_user_id, p_gender, p_origin, p_hair, p_style)
  ON CONFLICT (user_id) DO UPDATE SET
    gender = p_gender, origin = p_origin,
    hair = p_hair, style = p_style,
    updated_at = now();

  -- 2. Start-Items freischalten
  INSERT INTO user_unlocked_items (user_id, item_type, item_code, unlocked_via)
  VALUES
    (p_user_id, 'accessory', 'none', 'free'),
    (p_user_id, 'effect', 'none', 'free'),
    (p_user_id, 'frame', 'bronze', 'free')
  ON CONFLICT DO NOTHING;

  -- 3. Passende Bronze-Karte finden
  v_card_id := find_best_matching_card(
    'bronze', p_gender, p_origin, p_hair, p_style, 'none', 'none'
  );

  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'Keine Bronze-Karte verfügbar';
  END IF;

  -- 4. Karte als claimed markieren
  UPDATE card_catalog SET is_claimed = true WHERE id = v_card_id;

  -- 5. Alte equipped Karte abwählen
  UPDATE user_cards SET is_equipped = false
  WHERE user_id = p_user_id AND is_equipped = true;

  -- 6. Neue Karte zuweisen
  INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
  VALUES (p_user_id, v_card_id, true, 'registration');

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════
-- 3. UPGRADE CARD (bei Item-Kauf)
-- ═══════════════════════════════════════
CREATE OR REPLACE FUNCTION upgrade_user_card(
  p_user_id UUID,
  p_item_type TEXT,   -- 'accessory', 'effect', 'frame'
  p_item_code TEXT
) RETURNS UUID AS $$
DECLARE
  v_dna RECORD;
  v_new_accessory TEXT;
  v_new_effect TEXT;
  v_new_frame TEXT;
  v_card_id UUID;
BEGIN
  -- 1. DNA laden
  SELECT * INTO v_dna FROM user_avatar_dna WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User hat keine Avatar DNA';
  END IF;

  -- 2. Neue Werte bestimmen
  v_new_accessory := v_dna.current_accessory;
  v_new_effect := v_dna.current_effect;
  v_new_frame := v_dna.current_frame;

  IF p_item_type = 'accessory' THEN v_new_accessory := p_item_code; END IF;
  IF p_item_type = 'effect' THEN v_new_effect := p_item_code; END IF;
  IF p_item_type = 'frame' THEN v_new_frame := p_item_code; END IF;

  -- 3. Item freischalten
  INSERT INTO user_unlocked_items (user_id, item_type, item_code, unlocked_via)
  VALUES (p_user_id, p_item_type, p_item_code, 'coins')
  ON CONFLICT DO NOTHING;

  -- 4. Passende neue Karte finden
  v_card_id := find_best_matching_card(
    v_new_frame, v_dna.gender, v_dna.origin, v_dna.hair, v_dna.style,
    v_new_accessory, v_new_effect
  );

  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'Keine passende Karte verfügbar für Frame: %', v_new_frame;
  END IF;

  -- 5. Alte Karte: is_equipped = false (BLEIBT in Sammlung!)
  UPDATE user_cards SET is_equipped = false
  WHERE user_id = p_user_id AND is_equipped = true;

  -- 6. Neue Karte zuweisen
  UPDATE card_catalog SET is_claimed = true WHERE id = v_card_id;
  INSERT INTO user_cards (user_id, card_id, is_equipped, obtained_from)
  VALUES (p_user_id, v_card_id, true, 'upgrade');

  -- 7. DNA updaten
  UPDATE user_avatar_dna SET
    current_accessory = v_new_accessory,
    current_effect = v_new_effect,
    current_frame = v_new_frame,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
