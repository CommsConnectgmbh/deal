-- ============================================================
-- DealBuddy MIGRATION V12 – Fix Wallet & Coin System
-- Run in Supabase SQL Editor
-- Fixes: wallet_ledger CHECK constraint, atomic coin functions
-- ============================================================

-- ─── 1. Fix wallet_ledger reason constraint ────────────────────────────────────
-- Drop the old constraint and add ALL reason values used across the codebase
ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_reason_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_reason_check
  CHECK (reason IN (
    -- Original V7 values
    'win_reward',
    'participation_reward',
    'purchase_stripe',
    'battlepass_reward',
    'equip_purchase',
    'cosmetic_purchase',
    'avatar_purchase',
    'box_open',
    'style_pack',
    'admin',
    'refund',
    'level_up',
    'signup_bonus',
    -- V9 Archetypes
    'archetype_purchase',
    'avatar_reset',
    -- V11 Frames & Packs
    'frame_purchase',
    'pack_purchase',
    'pack_coin_reward',
    'duplicate_refund',
    -- Edge Functions
    'style_pack_purchase',
    'reward_box_open',
    'reward_box_win_coins',
    'side_bet_won',
    -- Frontend rewards
    'daily_challenge',
    'weekly_challenge',
    'login_streak',
    'daily_login',
    'streak_reward',
    'challenge_reward',
    'welcome_bonus',
    -- Card system
    'card_pack_purchase',
    'card_dust_refund'
  ));

-- ─── 2. Ensure add_coins function exists (atomic) ─────────────────────────────
CREATE OR REPLACE FUNCTION add_coins(p_user_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE profiles
  SET coins = coins + p_amount
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 3. Ensure deduct_coins function exists (atomic, with balance check) ──────
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 4. Grant execute permissions ──────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION add_coins(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION add_coins(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION deduct_coins(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_coins(UUID, INTEGER) TO service_role;

-- ─── Done ──────────────────────────────────────────────────────────────────────
-- After this migration:
-- • All wallet_ledger inserts will succeed (all reason values allowed)
-- • add_coins and deduct_coins are available as atomic RPC functions
-- • Coin purchases, rewards, and spending will work again
