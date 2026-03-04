-- ============================================================
-- DealBuddy MIGRATION V5 – Fix Registration / handle_new_user
-- Run in Supabase SQL Editor AFTER V2, V3, V4
-- ============================================================

-- ─── 1. Ensure user_inventory table exists ────────────────────────────────────
-- The register page and shop use 'user_inventory' for cosmetics.
-- This table was referenced in code but never explicitly created in migrations.

CREATE TABLE IF NOT EXISTS user_inventory (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cosmetic_id TEXT NOT NULL,
  source      TEXT DEFAULT 'purchase',
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, cosmetic_id)
);

ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist, then recreate
DROP POLICY IF EXISTS "user_inv_select_own"  ON user_inventory;
DROP POLICY IF EXISTS "user_inv_insert_own"  ON user_inventory;
DROP POLICY IF EXISTS "user_inv_update_own"  ON user_inventory;
DROP POLICY IF EXISTS "user_inv_delete_own"  ON user_inventory;
DROP POLICY IF EXISTS "service_insert_notifs" ON user_inventory;

CREATE POLICY "user_inv_select_own" ON user_inventory
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "user_inv_insert_own" ON user_inventory
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_inv_delete_own" ON user_inventory
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Service-role can insert (for edge functions / triggers)
CREATE POLICY "user_inv_service_insert" ON user_inventory
  FOR INSERT WITH CHECK (TRUE);

-- ─── 2. Rewrite handle_new_user() – remove broken inventory inserts ───────────
-- The old trigger referenced public.inventory which either no longer exists or
-- has a unique-constraint issue, causing "Database error saving new user".
-- Founder cosmetics are now granted client-side in the register page via user_inventory.
-- Avatar defaults are handled by the on_profile_created_grant_avatar trigger (V3).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  founder_count INTEGER;
  uname         TEXT;
  safe_uname    TEXT;
BEGIN
  -- ── 1. Resolve username ──────────────────────────────────────────────────────
  -- Prefer metadata.username (passed from client), fall back to email prefix
  uname := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    split_part(NEW.email, '@', 1)
  );
  safe_uname := uname;

  -- ── 2. Count existing profiles for founder tracking ─────────────────────────
  SELECT COUNT(*) INTO founder_count FROM public.profiles;

  -- ── 3. Insert profile row ────────────────────────────────────────────────────
  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      display_name,
      is_founder,
      founder_number,
      active_frame,
      active_badge
    ) VALUES (
      NEW.id,
      safe_uname,
      safe_uname,
      founder_count < 1000,
      CASE WHEN founder_count < 1000 THEN founder_count + 1 ELSE NULL END,
      CASE WHEN founder_count < 1000 THEN 'founder_carbon' ELSE 'default' END,
      CASE WHEN founder_count < 1000 THEN 'season1_founder' ELSE NULL END
    );
  EXCEPTION WHEN unique_violation THEN
    -- Username already taken – append first 6 chars of the user UUID
    safe_uname := uname || '_' || SUBSTR(NEW.id::TEXT, 1, 6);
    INSERT INTO public.profiles (
      id,
      username,
      display_name,
      is_founder,
      founder_number,
      active_frame,
      active_badge
    ) VALUES (
      NEW.id,
      safe_uname,
      uname,             -- keep original as display_name
      founder_count < 1000,
      CASE WHEN founder_count < 1000 THEN founder_count + 1 ELSE NULL END,
      CASE WHEN founder_count < 1000 THEN 'founder_carbon' ELSE 'default' END,
      CASE WHEN founder_count < 1000 THEN 'season1_founder' ELSE NULL END
    )
    ON CONFLICT (id) DO NOTHING;
  END;

  -- ── 4. Grant founder cosmetics into user_inventory ───────────────────────────
  -- (Register page also does this client-side; ON CONFLICT DO NOTHING is safe)
  IF founder_count < 1000 THEN
    BEGIN
      INSERT INTO public.user_inventory (user_id, cosmetic_id, source)
      VALUES
        (NEW.id, 'founder_carbon',  'founder_grant'),
        (NEW.id, 'season1_founder', 'founder_grant')
      ON CONFLICT (user_id, cosmetic_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Non-fatal: client-side register page grants these too
      RAISE WARNING 'Could not grant founder cosmetics for %: %', NEW.email, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 3. Re-attach trigger (in case it was dropped or needs refresh) ───────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 4. Make grant_default_avatar robust (wrap in exception handler) ──────────
-- If avatar_items table is empty or missing, the trigger should not block signup.
CREATE OR REPLACE FUNCTION grant_default_avatar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Insert default avatar items into user_avatar_inventory
  BEGIN
    INSERT INTO user_avatar_inventory (user_id, item_id)
    SELECT NEW.id, id FROM avatar_items WHERE is_default = true
    ON CONFLICT (user_id, item_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'grant_default_avatar: user_avatar_inventory insert failed for %: %', NEW.id, SQLERRM;
  END;

  -- Create default avatar_config
  BEGIN
    INSERT INTO avatar_config (user_id, body, hair, outfit, accessory)
    VALUES (NEW.id, 'body_default', 'hair_default', 'outfit_default', 'acc_none')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'grant_default_avatar: avatar_config insert failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Re-attach (in case it drifted)
DROP TRIGGER IF EXISTS on_profile_created_grant_avatar ON profiles;
CREATE TRIGGER on_profile_created_grant_avatar
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION grant_default_avatar();

-- ─── 5. Fix wallet_ledger reason constraint to include avatar_purchase ─────────
-- The avatar shop uses reason='avatar_purchase' which is not in the original list.
ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_reason_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_reason_check
  CHECK (reason IN (
    'win_reward',
    'participation_reward',
    'purchase_stripe',
    'battlepass_reward',
    'equip_purchase',
    'avatar_purchase',
    'box_open',
    'style_pack',
    'admin',
    'refund',
    'level_up',
    'signup_bonus'
  ));

-- ─── 6. Fix stripe_transactions product_type constraint ───────────────────────
-- V2 only allows 3 types; V2→V3 shop has 6+ types.
ALTER TABLE stripe_transactions DROP CONSTRAINT IF EXISTS stripe_transactions_product_type_check;
ALTER TABLE stripe_transactions ADD CONSTRAINT stripe_transactions_product_type_check
  CHECK (product_type IN (
    'coin_pack_small',
    'coin_pack_large',
    'coin_pack_xs',
    'coin_pack_sm',
    'coin_pack_md',
    'coin_pack_lg',
    'premium_pass',
    'legendary_box',
    'style_pack_founder',
    'style_pack_elite'
  ));

-- ─── 7. Notifications: ensure title column is nullable (V4 tried NOT NULL) ────
-- V4 CREATE TABLE IF NOT EXISTS was a no-op; title is already nullable.
-- Just add reference_id column if it doesn't exist yet.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id TEXT;

-- ─── 8. Done ──────────────────────────────────────────────────────────────────
-- After running this migration:
-- 1. New registrations will succeed
-- 2. The username from the signup form is passed via metadata (see AuthContext fix)
-- 3. Founder cosmetics go into user_inventory (not the old inventory table)
-- 4. Avatar defaults still granted via on_profile_created_grant_avatar trigger
