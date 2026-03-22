-- ═══════════════════════════════════════════════════════════
-- MIGRATION V17 — Push Subscriptions Fix
-- Adds missing columns for push notification subscription storage
-- ═══════════════════════════════════════════════════════════

-- Add subscription_json column (stores full subscription object for edge function)
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_json TEXT;

-- Add updated_at column (for upsert tracking)
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Service role needs full access for the API route
-- RLS policy already exists: "push_sub_own" for authenticated users
-- Edge function uses service_role key which bypasses RLS
