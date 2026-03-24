-- ============================================================
-- MIGRATION V20: Fix mismatched card assignments from packs
-- Cards obtained from packs were not filtered by user DNA.
-- This migration finds and replaces mismatched cards.
-- ============================================================

-- ── STEP 1: Audit Query — find all mismatched pack cards ─────
-- Run this first to see the scope of the problem:

-- SELECT
--   uc.user_id,
--   uc.card_id,
--   uc.obtained_from,
--   cc.gender AS card_gender,
--   cc.age AS card_age,
--   dna.gender AS user_gender,
--   dna.age AS user_age,
--   CASE
--     WHEN cc.gender != dna.gender THEN 'GENDER_MISMATCH'
--     WHEN cc.age != dna.age THEN 'AGE_MISMATCH'
--   END AS mismatch_type
-- FROM user_cards uc
-- JOIN card_catalog cc ON cc.id = uc.card_id
-- JOIN user_avatar_dna dna ON dna.user_id = uc.user_id
-- WHERE uc.obtained_from = 'pack'
--   AND (cc.gender != dna.gender OR cc.age != dna.age);

-- ── STEP 2: Count mismatches by type ─────────────────────────

-- SELECT
--   CASE
--     WHEN cc.gender != dna.gender AND cc.age != dna.age THEN 'BOTH'
--     WHEN cc.gender != dna.gender THEN 'GENDER_ONLY'
--     WHEN cc.age != dna.age THEN 'AGE_ONLY'
--   END AS mismatch_type,
--   COUNT(*) AS count
-- FROM user_cards uc
-- JOIN card_catalog cc ON cc.id = uc.card_id
-- JOIN user_avatar_dna dna ON dna.user_id = uc.user_id
-- WHERE uc.obtained_from = 'pack'
--   AND (cc.gender != dna.gender OR cc.age != dna.age)
-- GROUP BY 1;

-- ── STEP 3: Replace mismatched cards with correct ones ───────
-- This function swaps each mismatched card for a matching one
-- of the same rarity, preserving the user's collection.

CREATE OR REPLACE FUNCTION fix_mismatched_pack_cards()
RETURNS TABLE(user_id UUID, old_card_id UUID, new_card_id UUID, old_gender TEXT, new_gender TEXT, old_age TEXT, new_age TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  v_replacement UUID;
BEGIN
  FOR rec IN
    SELECT
      uc.id AS user_card_id,
      uc.user_id,
      uc.card_id,
      uc.is_equipped,
      cc.rarity AS card_rarity,
      cc.gender AS card_gender,
      cc.age AS card_age,
      dna.gender AS user_gender,
      dna.age AS user_age
    FROM user_cards uc
    JOIN card_catalog cc ON cc.id = uc.card_id
    JOIN user_avatar_dna dna ON dna.user_id = uc.user_id
    WHERE uc.obtained_from = 'pack'
      AND (cc.gender != dna.gender OR cc.age != dna.age)
  LOOP
    -- Find a replacement card: same rarity, matching DNA
    -- Tier 1: exact gender + age match
    SELECT c.id INTO v_replacement
    FROM card_catalog c
    WHERE c.rarity = rec.card_rarity
      AND c.gender = rec.user_gender
      AND c.age = rec.user_age
      AND c.is_claimed = false
      AND c.is_available = true
      AND c.id NOT IN (SELECT uc2.card_id FROM user_cards uc2 WHERE uc2.user_id = rec.user_id)
    ORDER BY random()
    LIMIT 1;

    -- Tier 2: gender only
    IF v_replacement IS NULL THEN
      SELECT c.id INTO v_replacement
      FROM card_catalog c
      WHERE c.rarity = rec.card_rarity
        AND c.gender = rec.user_gender
        AND c.is_claimed = false
        AND c.is_available = true
        AND c.id NOT IN (SELECT uc2.card_id FROM user_cards uc2 WHERE uc2.user_id = rec.user_id)
      ORDER BY random()
      LIMIT 1;
    END IF;

    -- If we found a replacement, swap it
    IF v_replacement IS NOT NULL THEN
      -- Release old card back to pool
      UPDATE card_catalog SET is_claimed = false WHERE id = rec.card_id;

      -- Claim new card
      UPDATE card_catalog SET is_claimed = true WHERE id = v_replacement;

      -- Update user_cards to point to new card
      UPDATE user_cards SET card_id = v_replacement WHERE id = rec.user_card_id;

      -- Return result for logging
      user_id := rec.user_id;
      old_card_id := rec.card_id;
      new_card_id := v_replacement;
      old_gender := rec.card_gender;
      new_gender := rec.user_gender;
      old_age := rec.card_age;
      new_age := rec.user_age;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- ── STEP 4: Run the fix ──────────────────────────────────────
-- Uncomment and execute when ready:

-- SELECT * FROM fix_mismatched_pack_cards();

-- ── STEP 5: Verify — should return 0 rows after fix ─────────

-- SELECT COUNT(*) AS remaining_mismatches
-- FROM user_cards uc
-- JOIN card_catalog cc ON cc.id = uc.card_id
-- JOIN user_avatar_dna dna ON dna.user_id = uc.user_id
-- WHERE uc.obtained_from = 'pack'
--   AND (cc.gender != dna.gender OR cc.age != dna.age);

-- ── STEP 6: Cleanup ─────────────────────────────────────────
-- DROP FUNCTION IF EXISTS fix_mismatched_pack_cards();
