-- Fix assign_card_for_frame to match pre-generated cards first
CREATE OR REPLACE FUNCTION public.assign_card_for_frame(
  p_user_id UUID,
  p_frame TEXT,
  p_obtained_from TEXT DEFAULT 'shop'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  v_archetype TEXT;
  v_age TEXT;
BEGIN
  -- Get user avatar DNA
  SELECT gender, origin, hair, style INTO v_gender, v_origin, v_hair, v_style
  FROM public.user_avatar_dna WHERE user_id = p_user_id;

  IF v_gender IS NULL THEN
    v_gender := 'male';
    v_origin := 'european';
    v_hair := 'short';
    v_style := 'default';
  END IF;

  SELECT primary_archetype INTO v_archetype FROM public.profiles WHERE id = p_user_id;
  SELECT age INTO v_age FROM public.user_avatar_dna WHERE user_id = p_user_id;

  v_rarity := CASE
    WHEN p_frame IN ('bronze','silver') THEN 'common'
    WHEN p_frame = 'gold' THEN 'rare'
    WHEN p_frame IN ('emerald','sapphire','ruby','amethyst','topaz') THEN 'epic'
    WHEN p_frame IN ('obsidian','legend','icon','hero','crystal') THEN 'legendary'
    WHEN p_frame = 'founder' THEN 'founder'
    WHEN p_frame IN ('futties','neon','celestial','player_of_the_week') THEN 'event'
    ELSE 'common'
  END;

  -- TRY 1: Exact match on all attributes
  SELECT id INTO v_card_id FROM public.card_catalog
  WHERE frame = p_frame AND gender = v_gender AND origin = v_origin AND hair = v_hair
    AND archetype = COALESCE(v_archetype, 'dealer')
    AND age = COALESCE(v_age, 'young')
    AND is_claimed = false AND is_available = true
  LIMIT 1;

  -- TRY 2: Match without archetype
  IF v_card_id IS NULL THEN
    SELECT id INTO v_card_id FROM public.card_catalog
    WHERE frame = p_frame AND gender = v_gender AND origin = v_origin AND hair = v_hair
      AND is_claimed = false AND is_available = true
    LIMIT 1;
  END IF;

  -- TRY 3: Match gender+origin only
  IF v_card_id IS NULL THEN
    SELECT id INTO v_card_id FROM public.card_catalog
    WHERE frame = p_frame AND gender = v_gender AND origin = v_origin
      AND is_claimed = false AND is_available = true
    LIMIT 1;
  END IF;

  -- TRY 4: Any unclaimed card for this frame
  IF v_card_id IS NULL THEN
    SELECT id INTO v_card_id FROM public.card_catalog
    WHERE frame = p_frame AND is_claimed = false AND is_available = true
    LIMIT 1;
  END IF;

  IF v_card_id IS NOT NULL THEN
    -- Claim the existing pre-generated card
    UPDATE public.card_catalog SET is_claimed = true, is_available = false
    WHERE id = v_card_id;
  ELSE
    -- FALLBACK: Create new card entry if no pre-generated cards available
    SELECT COALESCE(MAX(serial_number::INT), 0) + 1 INTO v_serial
    FROM public.card_catalog WHERE frame = p_frame;

    v_serial_display := '#' || LPAD(v_serial::TEXT, 3, '0');
    v_card_code := UPPER(p_frame) || '-' || UPPER(v_gender) || '-' || UPPER(LEFT(v_origin, 3)) || '-' || v_serial;

    SELECT avatar_url INTO v_avatar_url FROM public.profiles WHERE id = p_user_id;

    INSERT INTO public.card_catalog (
      frame, rarity, gender, origin, hair, style,
      accessory, effect, card_code, serial_number, serial_display,
      image_url, is_claimed, is_available, season, archetype, age
    ) VALUES (
      p_frame, v_rarity, v_gender, v_origin, v_hair, v_style,
      'none', 'none', v_card_code, v_serial::TEXT, v_serial_display,
      v_avatar_url, TRUE, FALSE, 'season_1',
      COALESCE(v_archetype, 'dealer'), COALESCE(v_age, 'young')
    ) RETURNING id INTO v_card_id;
  END IF;

  -- Un-equip any currently equipped card
  UPDATE public.user_cards SET is_equipped = FALSE
  WHERE user_id = p_user_id AND is_equipped = TRUE;

  -- Assign card to user
  INSERT INTO public.user_cards (user_id, card_id, is_equipped, obtained_from)
  VALUES (p_user_id, v_card_id, TRUE, p_obtained_from)
  RETURNING id INTO v_user_card_id;

  RETURN v_card_id;
END;
$$;
