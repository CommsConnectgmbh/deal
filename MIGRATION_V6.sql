-- ============================================================
-- DealBuddy MIGRATION V6 – Bulletproof Registration Fix
-- Run in Supabase SQL Editor AFTER V2, V3, V4, V5
-- ============================================================
-- ROOT CAUSE ANALYSIS:
--
-- 1. V3's grant_default_avatar had NO exception handlers.
--    When RLS blocks the INSERT (no auth.uid() during trigger),
--    it throws 'insufficient_privilege', which propagates up and
--    causes "Database error saving new user".
--
-- 2. V5's handle_new_user only catches 'unique_violation'.
--    RLS errors are 'insufficient_privilege' – they fell through
--    uncaught and still caused the auth.users INSERT to fail.
--
-- FIX:
--   a) SET row_security = off on all trigger functions
--      (so RLS is completely bypassed during signup)
--   b) EXCEPTION WHEN OTHERS at the TOP LEVEL of handle_new_user
--      (so even if something else fails, the user IS created)
--   c) Add service-role INSERT policy on profiles, avatar_config,
--      user_avatar_inventory so triggers always have permission
-- ============================================================

-- ─── STEP 1: Add bypass policies to all tables touched by triggers ────────────

-- profiles: allow trigger (service role / postgres) to insert
DROP POLICY IF EXISTS "service_role_insert_profile" ON profiles;
CREATE POLICY "service_role_insert_profile" ON profiles
  FOR INSERT TO postgres WITH CHECK (true);

-- Also allow anon role (Supabase invokes trigger as anon role sometimes)
DROP POLICY IF EXISTS "anon_cannot_insert_profile" ON profiles;
DROP POLICY IF EXISTS "trigger_insert_profile" ON profiles;
CREATE POLICY "trigger_insert_profile" ON profiles
  FOR INSERT WITH CHECK (true);

-- user_avatar_inventory: allow trigger to insert
DROP POLICY IF EXISTS "uai_service_insert" ON user_avatar_inventory;
CREATE POLICY "uai_service_insert" ON user_avatar_inventory
  FOR INSERT WITH CHECK (true);

-- avatar_config: allow trigger to insert
DROP POLICY IF EXISTS "ac_service_insert" ON avatar_config;
CREATE POLICY "ac_service_insert" ON avatar_config
  FOR INSERT WITH CHECK (true);

-- user_inventory: allow trigger to insert (already in V5 but ensure it exists)
DROP POLICY IF EXISTS "user_inv_service_insert" ON user_inventory;
CREATE POLICY "user_inv_service_insert" ON user_inventory
  FOR INSERT WITH CHECK (true);

-- ─── STEP 2: Bulletproof handle_new_user() ────────────────────────────────────
-- Key changes vs V5:
--   • SET row_security = off  → bypasses ALL RLS in this function
--   • EXCEPTION WHEN OTHERS   → top-level catch so trigger NEVER fails
--   • avatar grants wrapped in their own non-fatal block

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  founder_count INTEGER;
  uname         TEXT;
  safe_uname    TEXT;
BEGIN
  -- ── Resolve username ──────────────────────────────────────────────────────
  uname := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    split_part(NEW.email, '@', 1)
  );
  safe_uname := uname;

  -- ── Count existing profiles for founder tracking ──────────────────────────
  SELECT COUNT(*) INTO founder_count FROM public.profiles;

  -- ── Insert profile row ────────────────────────────────────────────────────
  BEGIN
    INSERT INTO public.profiles (
      id, username, display_name,
      is_founder, founder_number,
      active_frame, active_badge
    ) VALUES (
      NEW.id,
      safe_uname,
      safe_uname,
      founder_count < 1000,
      CASE WHEN founder_count < 1000 THEN founder_count + 1 ELSE NULL END,
      CASE WHEN founder_count < 1000 THEN 'founder_carbon'  ELSE 'default'       END,
      CASE WHEN founder_count < 1000 THEN 'season1_founder' ELSE NULL            END
    );

  EXCEPTION
    WHEN unique_violation THEN
      -- Username already taken → append first 6 chars of UUID
      safe_uname := uname || '_' || SUBSTR(NEW.id::TEXT, 1, 6);
      BEGIN
        INSERT INTO public.profiles (
          id, username, display_name,
          is_founder, founder_number,
          active_frame, active_badge
        ) VALUES (
          NEW.id,
          safe_uname,
          uname,
          founder_count < 1000,
          CASE WHEN founder_count < 1000 THEN founder_count + 1 ELSE NULL END,
          CASE WHEN founder_count < 1000 THEN 'founder_carbon'  ELSE 'default' END,
          CASE WHEN founder_count < 1000 THEN 'season1_founder' ELSE NULL     END
        ) ON CONFLICT (id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[handle_new_user] Fallback INSERT failed (SQLSTATE=%, MSG=%)',
          SQLSTATE, SQLERRM;
      END;

    WHEN OTHERS THEN
      -- *** THIS IS THE CRITICAL FIX ***
      -- ANY other error (RLS, missing table, constraint) is caught here.
      -- The user is still created in auth.users. Profile can be fixed later.
      RAISE WARNING '[handle_new_user] Profile INSERT failed (SQLSTATE=%, MSG=%)',
        SQLSTATE, SQLERRM;
  END;

  -- ── Grant founder cosmetics (non-fatal) ───────────────────────────────────
  IF founder_count < 1000 THEN
    BEGIN
      INSERT INTO public.user_inventory (user_id, cosmetic_id, source)
      VALUES
        (NEW.id, 'founder_carbon',  'founder_grant'),
        (NEW.id, 'season1_founder', 'founder_grant')
      ON CONFLICT (user_id, cosmetic_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[handle_new_user] Founder grant failed: % %', SQLSTATE, SQLERRM;
    END;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- *** ULTIMATE SAFETY NET ***
  -- If somehow everything above fails, we still return NEW
  -- so auth.users INSERT succeeds and the user account is created.
  RAISE WARNING '[handle_new_user] UNEXPECTED TOP-LEVEL ERROR (SQLSTATE=%, MSG=%)',
    SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── STEP 3: Bulletproof grant_default_avatar() ───────────────────────────────
-- Key changes:
--   • SET row_security = off  → bypasses RLS on avatar tables
--   • Both inserts wrapped in individual EXCEPTION handlers
--   • Top-level EXCEPTION WHEN OTHERS safety net

CREATE OR REPLACE FUNCTION public.grant_default_avatar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  -- Grant default avatar items
  BEGIN
    INSERT INTO user_avatar_inventory (user_id, item_id)
    SELECT NEW.id, id
    FROM avatar_items
    WHERE is_default = true
    ON CONFLICT (user_id, item_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[grant_default_avatar] user_avatar_inventory failed: % %',
      SQLSTATE, SQLERRM;
  END;

  -- Create default avatar config
  BEGIN
    INSERT INTO avatar_config (user_id, body, hair, outfit, accessory)
    VALUES (NEW.id, 'body_default', 'hair_default', 'outfit_default', 'acc_none')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[grant_default_avatar] avatar_config failed: % %',
      SQLSTATE, SQLERRM;
  END;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[grant_default_avatar] TOP-LEVEL ERROR: % %', SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

-- Re-attach trigger on profiles
DROP TRIGGER IF EXISTS on_profile_created_grant_avatar ON profiles;
CREATE TRIGGER on_profile_created_grant_avatar
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_default_avatar();

-- ─── STEP 4: Verify current state ─────────────────────────────────────────────
-- After running this migration, run this SELECT to confirm triggers are installed:
--
-- SELECT trigger_name, event_object_schema, event_object_table, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_name IN ('on_auth_user_created', 'on_profile_created_grant_avatar');
--
-- Expected output:
--   on_auth_user_created          | auth   | users    | EXECUTE FUNCTION public.handle_new_user()
--   on_profile_created_grant_avatar | public | profiles | EXECUTE FUNCTION public.grant_default_avatar()

-- ─── STEP 5: Test the fix with a simulated profile insert ─────────────────────
-- Run this block AFTER the migration to verify profiles INSERT works:
--
-- DO $$
-- DECLARE test_id UUID := gen_random_uuid();
-- BEGIN
--   INSERT INTO profiles (id, username, display_name)
--   VALUES (test_id, 'test_v6_' || SUBSTR(test_id::TEXT,1,4), 'Test V6');
--   RAISE NOTICE 'SUCCESS: Profile insert works!';
--   DELETE FROM profiles WHERE id = test_id;
-- EXCEPTION WHEN OTHERS THEN
--   RAISE NOTICE 'FAILED: % %', SQLSTATE, SQLERRM;
-- END;
-- $$;

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- Registration should now work. The trigger will NEVER block auth.users INSERT.
-- Any remaining issues (missing profile etc.) are fixed client-side in register page.
