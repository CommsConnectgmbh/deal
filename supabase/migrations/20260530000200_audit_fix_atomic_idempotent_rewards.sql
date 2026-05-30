-- ============================================================
-- 20260530000200_audit_fix_atomic_idempotent_rewards.sql
-- Audit-Fix 2026-05-30 (P1-3)
-- Atomare, idempotente Coin-/XP-Gutschriften über wallet_ledger.
-- Read-then-write Races (Doppelklick/Tabs) und Client-Direktwrites
-- (durch P0-1 ohnehin geblockt) werden eliminiert.
-- Idempotent.
-- ============================================================

-- Idempotenz-Key: (user_id, reason, reference_id) eindeutig.
-- Vorab evtl. vorhandene Duplikate zusammenführen, damit der
-- UNIQUE-Index sicher erstellt werden kann.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_ledger'
  ) THEN
    -- Duplikate (gleicher user/reason/reference_id) auf eine Zeile reduzieren.
    DELETE FROM public.wallet_ledger a
    USING public.wallet_ledger b
    WHERE a.ctid < b.ctid
      AND a.user_id IS NOT DISTINCT FROM b.user_id
      AND a.reason = b.reason
      AND a.reference_id IS NOT DISTINCT FROM b.reference_id
      AND a.reference_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_ledger_idem
      ON public.wallet_ledger (user_id, reason, reference_id)
      WHERE reference_id IS NOT NULL;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- grant_coins_idempotent: bucht p_amount Coins genau einmal je
-- (user, reason, reference_id). Gibt true zurück, wenn neu gebucht,
-- false wenn der Reward bereits eingelöst war.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_coins_idempotent(
  p_amount       INTEGER,
  p_reason       TEXT,
  p_reference_id TEXT,
  p_xp           INTEGER DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF COALESCE(p_amount, 0) < 0 OR COALESCE(p_xp, 0) < 0 THEN
    RAISE EXCEPTION 'amount_must_not_be_negative';
  END IF;
  IF COALESCE(p_amount, 0) = 0 AND COALESCE(p_xp, 0) = 0 THEN
    RAISE EXCEPTION 'nothing_to_grant';
  END IF;
  IF p_reason IS NULL OR p_reference_id IS NULL THEN
    RAISE EXCEPTION 'reason_and_reference_required';
  END IF;

  -- Idempotenz: bei Konflikt nichts buchen.
  INSERT INTO public.wallet_ledger (user_id, delta, reason, reference_id)
  VALUES (v_user, COALESCE(p_amount, 0), p_reason, p_reference_id)
  ON CONFLICT (user_id, reason, reference_id) WHERE reference_id IS NOT NULL
  DO NOTHING;

  IF NOT FOUND THEN
    RETURN false;  -- bereits eingelöst
  END IF;

  -- Atomare Gutschrift (kein read-then-write).
  UPDATE public.profiles
  SET coins = COALESCE(coins, 0) + COALESCE(p_amount, 0),
      xp    = COALESCE(xp, 0)    + COALESCE(p_xp, 0)
  WHERE id = v_user;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_coins_idempotent(INTEGER, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_coins_idempotent(INTEGER, TEXT, TEXT, INTEGER) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- complete_onboarding_bonus: koppelt den 50-Coin-Willkommensbonus
-- hart an onboarding_completed=false → nicht farmbar.
-- ────────────────────────────────────────────────────────────
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

  -- Nur gutschreiben, wenn Onboarding noch offen ist (atomar).
  UPDATE public.profiles
  SET onboarding_completed = true,
      coins = COALESCE(coins, 0) + 50
  WHERE id = v_user
    AND COALESCE(onboarding_completed, false) = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    -- Onboarding war bereits abgeschlossen → kein Bonus.
    -- Sicherstellen, dass das Flag gesetzt ist.
    UPDATE public.profiles SET onboarding_completed = true WHERE id = v_user;
    RETURN false;
  END IF;

  INSERT INTO public.wallet_ledger (user_id, delta, reason, reference_id)
  VALUES (v_user, 50, 'welcome_bonus', 'onboarding')
  ON CONFLICT (user_id, reason, reference_id) WHERE reference_id IS NOT NULL
  DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding_bonus() TO authenticated;
