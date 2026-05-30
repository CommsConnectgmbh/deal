-- ============================================================
-- 20260530000000_audit_fix_economy_rls_lockdown.sql
-- Audit-Fix 2026-05-30 (P0-1, P0-2, P0-3, P1-4)
-- Idempotent. Sperrt clientseitiges Schreiben von Economy-Feldern,
-- erzwingt server-autoritatives Settlement und honoriert is_private.
--
-- Vertrauens-Gate (zentral):
--   Direkte Client-UPDATEs laufen als DB-Rolle 'authenticated'/'anon'.
--   Alle legitimen Economy-Mutationen laufen entweder als 'service_role'
--   (Edge Functions mit Service-Key) ODER innerhalb einer SECURITY
--   DEFINER Funktion, die 'postgres'/'supabase_admin' gehört — in dem
--   Fall ist current_user die privilegierte Owner-Rolle, nicht
--   'authenticated'. Wir blockieren also genau dann, wenn current_user
--   eine unprivilegierte Client-Rolle ist.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_trusted_economy_writer()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Unprivilegierte Client-Rollen → NICHT vertrauenswürdig.
  IF current_user IN ('authenticated', 'anon') THEN
    RETURN false;
  END IF;
  -- Alles andere (postgres/supabase_admin/service_role/Migrationen) ok.
  RETURN true;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- P0-1: profiles — coins/xp/level/wins/losses/battle_pass_*/
--       reputation/founder/season NUR serverseitig schreibbar.
--       Client darf nur unkritische Profil-Felder ändern.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lock_protected_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF public.is_trusted_economy_writer() THEN
    RETURN NEW;
  END IF;

  -- Client: geschützte Economy-Felder zwangsweise auf Altwert.
  NEW.coins                := OLD.coins;
  NEW.xp                   := OLD.xp;
  NEW.level                := OLD.level;
  NEW.wins                 := OLD.wins;
  NEW.losses               := OLD.losses;
  NEW.deals_total          := OLD.deals_total;
  NEW.streak               := OLD.streak;
  NEW.battle_pass_premium  := OLD.battle_pass_premium;
  NEW.battle_pass_level    := OLD.battle_pass_level;
  NEW.battle_pass_xp       := OLD.battle_pass_xp;
  NEW.claimed_bp_rewards   := OLD.claimed_bp_rewards;
  NEW.reputation_score     := OLD.reputation_score;
  NEW.is_founder           := OLD.is_founder;
  NEW.founder_number       := OLD.founder_number;
  NEW.current_season       := OLD.current_season;
  NEW.season_completed     := OLD.season_completed;
  NEW.card_dust            := OLD.card_dust;
  NEW.reliability_score    := OLD.reliability_score;
  NEW.reliability_color    := OLD.reliability_color;
  NEW.reliability_fulfilled_count   := OLD.reliability_fulfilled_count;
  NEW.reliability_unfulfilled_count := OLD.reliability_unfulfilled_count;
  NEW.is_verified_payer    := OLD.is_verified_payer;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_protected_profile_columns ON public.profiles;
CREATE TRIGGER trg_lock_protected_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_protected_profile_columns();

-- WITH CHECK an der Client-Policy (Defense in Depth: keine Fremdzeilen).
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ────────────────────────────────────────────────────────────
-- P0-2: tip_bonus_answers — points_earned nur serverseitig.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lock_bonus_answer_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF public.is_trusted_economy_writer() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.points_earned := 0;
  ELSE
    NEW.points_earned := OLD.points_earned;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_bonus_answer_points ON public.tip_bonus_answers;
CREATE TRIGGER trg_lock_bonus_answer_points
  BEFORE INSERT OR UPDATE ON public.tip_bonus_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_bonus_answer_points();

DROP POLICY IF EXISTS "bonus_answers_update" ON public.tip_bonus_answers;
CREATE POLICY "bonus_answers_update" ON public.tip_bonus_answers
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- P0-3: challenges — Settlement (status='completed' + winner_id +
--       confirmed_at) ausschließlich serverseitig (confirm-winner).
--       Übrige Teilnehmer-Updates (Vorschlag/Dispute/Proof) bleiben.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lock_challenge_settlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF public.is_trusted_economy_writer() THEN
    RETURN NEW;
  END IF;

  -- Client darf 'completed' nicht selbst herstellen.
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    RAISE EXCEPTION 'settlement_must_use_confirm_winner'
      USING ERRCODE = 'check_violation';
  END IF;

  -- winner_id / confirmed_at bleiben serverseitig reserviert.
  IF NEW.winner_id IS DISTINCT FROM OLD.winner_id THEN
    NEW.winner_id := OLD.winner_id;
  END IF;
  IF NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
    NEW.confirmed_at := OLD.confirmed_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_challenge_settlement ON public.challenges;
CREATE TRIGGER trg_lock_challenge_settlement
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_challenge_settlement();

-- ────────────────────────────────────────────────────────────
-- P1-4: is_private honorieren. Private Profile nur für Owner lesbar,
--       öffentliche Profile bleiben offen.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Profiles public read" ON public.profiles;
CREATE POLICY "Profiles public read" ON public.profiles
  FOR SELECT
  USING (
    COALESCE(is_private, false) = false
    OR auth.uid() = id
  );
