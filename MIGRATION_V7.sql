-- ============================================================
-- DealBuddy MIGRATION V7 – Stripe & Shop Fixes
-- Run in Supabase SQL Editor
-- ============================================================

-- ─── 1. Ensure stripe_transactions table exists ───────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_transactions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id    TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  product_type  TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL DEFAULT 0,
  coins_awarded INTEGER NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stripe_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stripe_tx_select_own" ON stripe_transactions;
CREATE POLICY "stripe_tx_select_own" ON stripe_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role can do everything (for webhook + API route)
DROP POLICY IF EXISTS "stripe_tx_service_all" ON stripe_transactions;
CREATE POLICY "stripe_tx_service_all" ON stripe_transactions
  FOR ALL WITH CHECK (true);

-- ─── 2. Fix wallet_ledger reason constraint ───────────────────────────────────
-- Add 'cosmetic_purchase' which the shop uses when buying items with coins
ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_reason_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_reason_check
  CHECK (reason IN (
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
    'signup_bonus'
  ));

-- ─── 3. Remove any leftover product_type constraint on stripe_transactions ────
-- (so any product_type string is accepted)
ALTER TABLE stripe_transactions
  DROP CONSTRAINT IF EXISTS stripe_transactions_product_type_check;

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- After this migration:
-- • Stripe Checkout session creation will work (stripe_transactions table exists)
-- • Buying cosmetics with coins will work (cosmetic_purchase reason allowed)
-- • The shop button will now show real error messages instead of doing nothing
