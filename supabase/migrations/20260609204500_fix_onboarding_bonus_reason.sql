-- Fix: complete_onboarding_bonus() schrieb reason='welcome_bonus' ins
-- wallet_ledger, aber der CHECK-Constraint wallet_ledger_reason_check
-- erlaubt nur 'signup_bonus'. Folge: jeder neue User crashte beim
-- Onboarding-RPC, Transaktion rollte zurück, onboarding_completed blieb
-- false → /app/welcome → /app/layout.tsx redirect-Loop.
-- Acht User hingen fest, alle separat per Backfill freigeschaltet.

CREATE OR REPLACE FUNCTION public.complete_onboarding_bonus()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_updated INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.profiles
  SET onboarding_completed = true,
      coins = COALESCE(coins, 0) + 50
  WHERE id = v_user
    AND COALESCE(onboarding_completed, false) = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    UPDATE public.profiles SET onboarding_completed = true WHERE id = v_user;
    RETURN false;
  END IF;

  INSERT INTO public.wallet_ledger (user_id, delta, reason, reference_id)
  VALUES (v_user, 50, 'signup_bonus', 'onboarding')
  ON CONFLICT (user_id, reason, reference_id) WHERE reference_id IS NOT NULL
  DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding_bonus() TO authenticated;
