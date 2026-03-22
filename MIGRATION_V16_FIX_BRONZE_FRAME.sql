-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION V16 — Fix Bronze Frame Equipping                    ║
-- ║  1. Backfill bronze into user_unlocked_items for ALL users     ║
-- ║  2. Update handle_new_user() to auto-grant bronze on signup    ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── 1. BACKFILL: Ensure ALL users have bronze frame ─────────────
-- (V14 did this but only for users existing at that time)
INSERT INTO user_unlocked_items (user_id, item_type, item_code, unlocked_via)
SELECT id, 'frame', 'bronze', 'free' FROM profiles
ON CONFLICT (user_id, item_type, item_code) DO NOTHING;

-- ─── 2. UPDATE REGISTRATION TRIGGER ─────────────────────────────
-- Add bronze frame grant to handle_new_user() so new signups
-- automatically get it in user_unlocked_items

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
      RAISE WARNING '[handle_new_user] Profile INSERT failed (SQLSTATE=%, MSG=%)',
        SQLSTATE, SQLERRM;
  END;

  -- ── Grant bronze frame to ALL new users (non-fatal) ──────────────────────
  BEGIN
    INSERT INTO public.user_unlocked_items (user_id, item_type, item_code, unlocked_via)
    VALUES (NEW.id, 'frame', 'bronze', 'free')
    ON CONFLICT (user_id, item_type, item_code) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[handle_new_user] Bronze frame grant failed: % %', SQLSTATE, SQLERRM;
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
  RAISE WARNING '[handle_new_user] UNEXPECTED TOP-LEVEL ERROR (SQLSTATE=%, MSG=%)',
    SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════
-- DONE — V16 Bronze Frame Fix
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════
