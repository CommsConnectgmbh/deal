-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION V15 — Idempotency & Race Condition Fixes           ║
-- ║  1. Add UNIQUE constraint on user_cards(user_id, card_id)     ║
-- ║  2. Add claim_card_atomic RPC for TOCTOU-safe card claiming   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── 1. UNIQUE CONSTRAINT: user_cards ───────────────────────────
-- Prevents duplicate card ownership rows from concurrent pack opens
-- First, clean up any existing duplicates (keep the earliest)
DELETE FROM user_cards a
USING user_cards b
WHERE a.user_id = b.user_id
  AND a.card_id = b.card_id
  AND a.created_at > b.created_at;

-- Now add the unique constraint
ALTER TABLE user_cards
  ADD CONSTRAINT user_cards_user_card_unique
  UNIQUE (user_id, card_id);

-- ─── 2. ATOMIC CARD CLAIMING RPC ───────────────────────────────
-- Claims a single unclaimed card of given rarity atomically
-- Uses UPDATE ... WHERE is_claimed = false ... LIMIT 1 RETURNING *
-- This prevents TOCTOU race conditions in open-card-pack
CREATE OR REPLACE FUNCTION claim_card_atomic(
  p_rarity TEXT,
  p_offset INT DEFAULT 0
)
RETURNS SETOF card_catalog
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_card_id UUID;
BEGIN
  -- Atomically select + claim one unclaimed card
  UPDATE card_catalog
  SET is_claimed = true
  WHERE id = (
    SELECT id FROM card_catalog
    WHERE rarity = p_rarity
      AND is_claimed = false
      AND is_available = true
    ORDER BY created_at
    OFFSET p_offset
    LIMIT 1
    FOR UPDATE SKIP LOCKED  -- skip rows locked by concurrent claims
  )
  RETURNING * INTO v_card_id;

  -- Return the claimed card
  RETURN QUERY
    SELECT * FROM card_catalog WHERE id = v_card_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- DONE — V15 Idempotency Fixes
-- Run this in Supabase SQL Editor before deploying updated edge functions
-- ═══════════════════════════════════════════════════════════════════
