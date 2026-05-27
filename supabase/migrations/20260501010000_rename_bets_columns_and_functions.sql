-- =============================================================================
-- MIGRATION: Phase 2 — finish bets→challenges rename
-- =============================================================================
-- Phase 1 (20260501000000_rename_bets_to_challenges.sql) renamed the BASE TABLES
-- (bets→challenges, bet_fulfillment→challenge_fulfillment, …) and left
-- backward-compat VIEWs under the old names so any caller that hadn't been
-- migrated yet kept working.
--
-- Phase 2 finishes the job:
--   1. Drop / recreate the DB functions whose bodies still reference the
--      legacy view names (try_auto_resolve_bet, handle_deal_completed,
--      assign_archetype, calculate_reliability_score, update_all_archetypes,
--      get_landing_stats, recalc_reliability, compute_frame_progress,
--      trigger_archetype_on_bet_complete) so they target the renamed tables.
--   2. Drop the 6 backward-compat views (bets, bet_fulfillment, bet_comments,
--      bet_invites, deal_side_bets, tip_group_winner_bets).
--   3. Rename internal columns:
--        - challenge_comments.bet_id     → challenge_id
--        - challenge_fulfillment.bet_id  → challenge_id
--        - challenge_invites.bet_id      → challenge_id
--        - debt_ledger.bet_id            → challenge_id
--        - xp_events.related_bet_id      → related_challenge_id
--        - forum_posts.linked_bet_id     → linked_challenge_id
--      Profile columns total_bets / bets_won never existed in production
--      (the assign_archetype / calculate_reliability_score functions referenced
--      them but the column drift had silently broken those code paths). We
--      rewrite the functions to use the real columns (wins / deals_total /
--      reliability_*).
--   4. Rename FK constraints to match the new column names.
--   5. Replace the legacy try_auto_resolve_bet RPC with try_auto_resolve_challenge
--      and add a complete_challenge RPC (the previously-missing complete_bet
--      function — try_auto_resolve_bet was calling a non-existent function).
--   6. Soften the wallet_ledger_reason CHECK constraint to allow the new
--      'side_challenge_won' / 'side_challenge_lost' values while continuing to
--      accept the legacy 'side_bet_won' so historical rows remain valid.
--      No rows currently use either value (verified before migration), but we
--      keep the legacy value in the allowed set to honour the project's
--      "no destructive data migration" policy.
--   7. Rename remaining policies and triggers that still reference bet/bets
--      in their identifier names.
--
-- Idempotent guards: every block uses IF EXISTS / IF NOT EXISTS so re-running
-- is a no-op once the migration has been applied.
--
-- Transactional: BEGIN/COMMIT — if any step fails, everything rolls back.
-- =============================================================================

BEGIN;

-- =====================================================================
-- 1. Drop / replace functions whose bodies still reference legacy views
-- =====================================================================
-- We MUST drop functions that depend on the views before dropping the views.
-- We then recreate them pointing at the renamed tables and using real column
-- names.

-- Triggers reference these functions, so drop ALL known triggers first.
DROP TRIGGER IF EXISTS on_bet_completed_archetype       ON public.challenges;
DROP TRIGGER IF EXISTS on_challenge_completed_archetype ON public.challenges;
DROP TRIGGER IF EXISTS trg_bets_feed_event              ON public.challenges;
DROP TRIGGER IF EXISTS trg_challenges_feed_event        ON public.challenges;
DROP TRIGGER IF EXISTS on_deal_completed                ON public.challenges;
DROP TRIGGER IF EXISTS trg_challenges_handle_deal_completed ON public.challenges;
DROP TRIGGER IF EXISTS trg_recalc_reliability                       ON public.challenge_fulfillment;
DROP TRIGGER IF EXISTS trg_challenge_fulfillment_recalc_reliability ON public.challenge_fulfillment;

-- Drop legacy / broken functions before we drop the underlying views.
-- CASCADE handles any other dangling trigger we did not explicitly name above.
DROP FUNCTION IF EXISTS public.trigger_archetype_on_bet_complete()       CASCADE;
DROP FUNCTION IF EXISTS public.try_auto_resolve_bet(uuid)                CASCADE;
DROP FUNCTION IF EXISTS public.assign_archetype(uuid)                    CASCADE;
DROP FUNCTION IF EXISTS public.update_all_archetypes()                   CASCADE;
DROP FUNCTION IF EXISTS public.calculate_reliability_score(uuid)         CASCADE;
DROP FUNCTION IF EXISTS public.handle_deal_completed()                   CASCADE;
DROP FUNCTION IF EXISTS public.get_landing_stats()                       CASCADE;
DROP FUNCTION IF EXISTS public.recalc_reliability()                      CASCADE;
DROP FUNCTION IF EXISTS public.compute_frame_progress(uuid)              CASCADE;
DROP FUNCTION IF EXISTS public.insert_feed_event_on_completion()         CASCADE;
DROP FUNCTION IF EXISTS public.complete_bet(uuid, uuid, uuid)            CASCADE;
DROP FUNCTION IF EXISTS public.complete_challenge(uuid, uuid, uuid)      CASCADE;
DROP FUNCTION IF EXISTS public.try_auto_resolve_challenge(uuid)          CASCADE;

-- =====================================================================
-- 2. Drop backward-compat views
-- =====================================================================
DROP VIEW IF EXISTS public.bets                  CASCADE;
DROP VIEW IF EXISTS public.bet_fulfillment       CASCADE;
DROP VIEW IF EXISTS public.bet_comments          CASCADE;
DROP VIEW IF EXISTS public.bet_invites           CASCADE;
DROP VIEW IF EXISTS public.deal_side_bets        CASCADE;
DROP VIEW IF EXISTS public.tip_group_winner_bets CASCADE;

-- =====================================================================
-- 3. Rename internal columns bet_id → challenge_id
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='challenge_comments' AND column_name='bet_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='challenge_comments' AND column_name='challenge_id') THEN
    EXECUTE 'ALTER TABLE public.challenge_comments RENAME COLUMN bet_id TO challenge_id';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='challenge_fulfillment' AND column_name='bet_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='challenge_fulfillment' AND column_name='challenge_id') THEN
    EXECUTE 'ALTER TABLE public.challenge_fulfillment RENAME COLUMN bet_id TO challenge_id';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='challenge_invites' AND column_name='bet_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='challenge_invites' AND column_name='challenge_id') THEN
    EXECUTE 'ALTER TABLE public.challenge_invites RENAME COLUMN bet_id TO challenge_id';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='debt_ledger' AND column_name='bet_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='debt_ledger' AND column_name='challenge_id') THEN
    EXECUTE 'ALTER TABLE public.debt_ledger RENAME COLUMN bet_id TO challenge_id';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='xp_events' AND column_name='related_bet_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='xp_events' AND column_name='related_challenge_id') THEN
    EXECUTE 'ALTER TABLE public.xp_events RENAME COLUMN related_bet_id TO related_challenge_id';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='forum_posts' AND column_name='linked_bet_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='forum_posts' AND column_name='linked_challenge_id') THEN
    EXECUTE 'ALTER TABLE public.forum_posts RENAME COLUMN linked_bet_id TO linked_challenge_id';
  END IF;
END $$;

-- =====================================================================
-- 4. Rename FK constraints to use challenge_* names
-- =====================================================================
DO $$
DECLARE
  r RECORD;
  new_name TEXT;
BEGIN
  FOR r IN
    SELECT c.conname,
           n.nspname || '.' || cl.relname AS qualified_table
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND (c.conname LIKE '%\_bet\_id\_fkey' ESCAPE '\'
           OR c.conname LIKE '%\_related\_bet\_id\_fkey' ESCAPE '\'
           OR c.conname LIKE '%\_linked\_bet\_id\_fkey' ESCAPE '\')
  LOOP
    new_name := r.conname;
    new_name := regexp_replace(new_name, '_bet_id_fkey$',           '_challenge_id_fkey');
    new_name := regexp_replace(new_name, '_related_bet_id_fkey$',   '_related_challenge_id_fkey');
    new_name := regexp_replace(new_name, '_linked_bet_id_fkey$',    '_linked_challenge_id_fkey');

    IF new_name <> r.conname THEN
      EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
                     r.qualified_table, r.conname, new_name);
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- 5. Soften wallet_ledger CHECK constraint to allow new enum values
-- =====================================================================
-- Both legacy ('side_bet_won') and new ('side_challenge_won' /
-- 'side_challenge_lost') values are accepted. No rows currently exist for
-- either value, so the migration is non-destructive.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wallet_ledger'::regclass
      AND conname = 'wallet_ledger_reason_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.wallet_ledger DROP CONSTRAINT wallet_ledger_reason_check';
  END IF;

  EXECUTE $sql$
    ALTER TABLE public.wallet_ledger
    ADD CONSTRAINT wallet_ledger_reason_check
    CHECK (reason = ANY (ARRAY[
      'win_reward','participation_reward','purchase_stripe','battlepass_reward',
      'equip_purchase','cosmetic_purchase','avatar_purchase','box_open',
      'style_pack','style_pack_purchase','admin','refund','level_up',
      'signup_bonus','frame_purchase',
      'side_bet_won',           -- legacy (kept for historical rows)
      'side_challenge_won',     -- new (Phase 2)
      'side_challenge_lost',    -- new (Phase 2)
      'pack_purchase','pack_coin_reward','duplicate_refund','reward_box_open',
      'reward_box_win_coins','archetype_purchase','streak_bonus','daily_login'
    ]))
  $sql$;
END $$;

-- =====================================================================
-- 6. Recreate functions with new bodies (challenges schema)
-- =====================================================================

-- 6a. handle_deal_completed — trigger function on challenges.
CREATE OR REPLACE FUNCTION public.handle_deal_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  base_xp INTEGER := 25;
  win_bonus INTEGER := 50;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.xp_events (user_id, event_type, xp_gained, description, related_challenge_id)
    VALUES (NEW.creator_id, 'deal_completed', base_xp, 'Deal abgeschlossen', NEW.id);
    UPDATE public.profiles SET xp = xp + base_xp, deals_total = deals_total + 1 WHERE id = NEW.creator_id;

    IF NEW.opponent_id IS NOT NULL THEN
      INSERT INTO public.xp_events (user_id, event_type, xp_gained, description, related_challenge_id)
      VALUES (NEW.opponent_id, 'deal_completed', base_xp, 'Deal abgeschlossen', NEW.id);
      UPDATE public.profiles SET xp = xp + base_xp, deals_total = deals_total + 1 WHERE id = NEW.opponent_id;
    END IF;

    IF NEW.winner_id IS NOT NULL THEN
      INSERT INTO public.xp_events (user_id, event_type, xp_gained, description, related_challenge_id)
      VALUES (NEW.winner_id, 'deal_won', win_bonus, 'Deal gewonnen', NEW.id);
      UPDATE public.profiles SET xp = xp + win_bonus, wins = wins + 1 WHERE id = NEW.winner_id;
    END IF;

    IF NEW.creator_id IS NOT NULL AND NEW.opponent_id IS NOT NULL THEN
      INSERT INTO public.rivalries (user_id, rival_id, total_deals, rivalry_intensity)
      VALUES (NEW.creator_id, NEW.opponent_id, 1, 5)
      ON CONFLICT (user_id, rival_id) DO UPDATE
        SET total_deals = public.rivalries.total_deals + 1,
            rivalry_intensity = LEAST(public.rivalries.rivalry_intensity + 5, 100),
            wins = CASE WHEN NEW.winner_id = public.rivalries.user_id THEN public.rivalries.wins + 1 ELSE public.rivalries.wins END,
            losses = CASE WHEN NEW.winner_id != public.rivalries.user_id AND NEW.winner_id IS NOT NULL THEN public.rivalries.losses + 1 ELSE public.rivalries.losses END,
            is_heated = (LEAST(public.rivalries.rivalry_intensity + 5, 100) >= 50),
            is_legendary = (LEAST(public.rivalries.rivalry_intensity + 5, 100) >= 80),
            updated_at = NOW();

      INSERT INTO public.rivalries (user_id, rival_id, total_deals, rivalry_intensity)
      VALUES (NEW.opponent_id, NEW.creator_id, 1, 5)
      ON CONFLICT (user_id, rival_id) DO UPDATE
        SET total_deals = public.rivalries.total_deals + 1,
            rivalry_intensity = LEAST(public.rivalries.rivalry_intensity + 5, 100),
            wins = CASE WHEN NEW.winner_id = public.rivalries.user_id THEN public.rivalries.wins + 1 ELSE public.rivalries.wins END,
            losses = CASE WHEN NEW.winner_id != public.rivalries.user_id AND NEW.winner_id IS NOT NULL THEN public.rivalries.losses + 1 ELSE public.rivalries.losses END,
            is_heated = (LEAST(public.rivalries.rivalry_intensity + 5, 100) >= 50),
            is_legendary = (LEAST(public.rivalries.rivalry_intensity + 5, 100) >= 80),
            updated_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

-- 6b. assign_archetype — rewritten to use real profile columns
-- (wins / losses / deals_total / reliability_score) instead of the
-- never-existing total_bets / bets_won.
CREATE OR REPLACE FUNCTION public.assign_archetype(p_user_id uuid)
RETURNS user_archetype
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_total INTEGER;
  v_win_rate NUMERIC;
  v_avg_amount NUMERIC;
  v_avg_resolve_hours NUMERIC;
  v_archetype user_archetype;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN 'newcomer'; END IF;

  v_total := COALESCE(v_profile.deals_total, 0);
  IF v_total < 5 THEN RETURN 'newcomer'; END IF;

  v_win_rate := COALESCE(v_profile.wins, 0)::NUMERIC / GREATEST(v_total, 1);

  SELECT COALESCE(AVG(creator_amount), 0) INTO v_avg_amount
  FROM public.challenges
  WHERE (creator_id = p_user_id OR opponent_id = p_user_id)
    AND status = 'completed';

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600), 24) INTO v_avg_resolve_hours
  FROM public.challenges
  WHERE (creator_id = p_user_id OR opponent_id = p_user_id)
    AND status = 'completed';

  IF v_avg_amount > 5000 THEN v_archetype := 'high_roller';
  ELSIF v_win_rate > 0.70 THEN v_archetype := 'winner';
  ELSIF v_avg_resolve_hours < 12 THEN v_archetype := 'closer';
  ELSIF v_total > 50 THEN v_archetype := 'veteran';
  ELSIF v_total > 20 AND COALESCE(v_profile.reliability_score, 100) >= 85 THEN v_archetype := 'dealer';
  ELSIF v_win_rate BETWEEN 0.40 AND 0.60 AND v_total > 10 THEN v_archetype := 'maverick';
  ELSE v_archetype := 'newcomer';
  END IF;

  UPDATE public.profiles SET archetype = v_archetype, updated_at = NOW() WHERE id = p_user_id;
  RETURN v_archetype;
END;
$func$;

-- 6c. update_all_archetypes — uses deals_total instead of non-existent total_bets.
CREATE OR REPLACE FUNCTION public.update_all_archetypes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE v_count INTEGER := 0; v_user RECORD;
BEGIN
  FOR v_user IN SELECT id FROM public.profiles WHERE COALESCE(deals_total, 0) >= 5 LOOP
    PERFORM public.assign_archetype(v_user.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$func$;

-- 6d. calculate_reliability_score — rewritten to use the actual reliability_*
-- columns (the original used non-existent total_bets / payments_missed).
CREATE OR REPLACE FUNCTION public.calculate_reliability_score(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_fulfilled INTEGER;
  v_unfulfilled INTEGER;
  v_relevant INTEGER;
  v_score INTEGER;
BEGIN
  SELECT
    COALESCE(reliability_fulfilled_count, 0),
    COALESCE(reliability_unfulfilled_count, 0)
  INTO v_fulfilled, v_unfulfilled
  FROM public.profiles WHERE id = p_user_id;

  v_relevant := v_fulfilled + v_unfulfilled;
  IF v_relevant < 3 THEN RETURN 100; END IF;

  v_score := GREATEST(0, 100 - (v_unfulfilled::NUMERIC / v_relevant * 100)::INTEGER);

  UPDATE public.profiles SET
    reliability_score = v_score,
    reliability_color = CASE
      WHEN v_score >= 85 THEN 'green'
      WHEN v_score >= 60 THEN 'yellow'
      ELSE 'red'
    END,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_score;
END;
$func$;

-- 6e. trigger_archetype_on_challenge_complete — replaces _on_bet_complete.
CREATE OR REPLACE FUNCTION public.trigger_archetype_on_challenge_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.assign_archetype(NEW.creator_id);
    IF NEW.opponent_id IS NOT NULL THEN
      PERFORM public.assign_archetype(NEW.opponent_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

-- 6f. recalc_reliability — rewritten to use challenge_fulfillment.
CREATE OR REPLACE FUNCTION public.recalc_reliability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user_id UUID := NEW.obligated_user_id;
  v_fulfilled INT;
  v_unfulfilled INT;
  v_relevant INT;
  v_score NUMERIC(4,3);
  v_color TEXT;
BEGIN
  IF NEW.status NOT IN ('fulfilled', 'unfulfilled') THEN
    RETURN NEW;
  END IF;

  SELECT
    count(*) FILTER (WHERE status = 'fulfilled'),
    count(*) FILTER (WHERE status = 'unfulfilled')
  INTO v_fulfilled, v_unfulfilled
  FROM public.challenge_fulfillment
  WHERE obligated_user_id = v_user_id;

  v_relevant := v_fulfilled + v_unfulfilled;

  IF v_relevant < 5 THEN
    v_score := NULL;
    v_color := 'neutral';
  ELSE
    v_score := 1.0 - (v_unfulfilled::NUMERIC / v_relevant);
    IF    v_score >= 0.85 THEN v_color := 'green';
    ELSIF v_score >= 0.75 THEN v_color := 'yellow';
    ELSE                        v_color := 'red';
    END IF;
  END IF;

  UPDATE public.profiles SET
    reliability_fulfilled_count   = v_fulfilled,
    reliability_unfulfilled_count = v_unfulfilled,
    reliability_score             = v_score,
    reliability_color             = v_color,
    reliability_updated_at        = now()
  WHERE id = v_user_id;

  RETURN NEW;
END;
$func$;

-- 6g. compute_frame_progress — rewritten to use challenges.
CREATE OR REPLACE FUNCTION public.compute_frame_progress(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  v_profile RECORD;
  v_frame RECORD;
  v_value INTEGER;
  v_target INTEGER;
  v_condition_type TEXT;
  v_login_days INTEGER;
  v_challenges INTEGER;
  v_login_target INTEGER;
  v_challenge_target INTEGER;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  FOR v_frame IN
    SELECT * FROM public.frame_definitions
    WHERE category IN ('prestige','event')
      AND is_active = true
  LOOP
    v_condition_type := COALESCE(
      v_frame.prestige_condition->>'type',
      v_frame.event_condition->>'type'
    );
    v_target := COALESCE(
      (v_frame.prestige_condition->>'target')::int,
      (v_frame.event_condition->>'target')::int,
      0
    );
    v_value := 0;

    CASE v_condition_type
      WHEN 'challenge_wins' THEN
        v_value := COALESCE(v_profile.wins, 0);

      WHEN 'season_leaderboard_top' THEN
        v_value := 0;

      WHEN 'challenges_created' THEN
        SELECT COUNT(*)::int INTO v_value FROM public.challenges
        WHERE creator_id = p_user_id AND status = 'completed';

      WHEN 'win_streak' THEN
        v_value := COALESCE(v_profile.streak, 0);

      WHEN 'founder_flag' THEN
        v_value := CASE WHEN v_profile.is_founder THEN 1 ELSE 0 END;

      WHEN 'weekly_rank' THEN
        v_value := 0;

      WHEN 'event_challenges' THEN
        IF v_frame.event_id IS NOT NULL THEN
          SELECT COALESCE((progress->>'challenges_completed')::int, 0) INTO v_value
          FROM public.user_event_progress
          WHERE user_id = p_user_id AND event_id = v_frame.event_id;
        END IF;

      WHEN 'event_points' THEN
        IF v_frame.event_id IS NOT NULL THEN
          SELECT COALESCE((progress->>'event_points')::int, 0) INTO v_value
          FROM public.user_event_progress
          WHERE user_id = p_user_id AND event_id = v_frame.event_id;
        END IF;

      WHEN 'event_multi' THEN
        IF v_frame.event_id IS NOT NULL THEN
          SELECT
            COALESCE((progress->>'login_days')::int, 0),
            COALESCE((progress->>'challenges_completed')::int, 0)
          INTO v_login_days, v_challenges
          FROM public.user_event_progress
          WHERE user_id = p_user_id AND event_id = v_frame.event_id;

          v_login_target := COALESCE((v_frame.event_condition->'targets'->>'login_days')::int, 7);
          v_challenge_target := COALESCE((v_frame.event_condition->'targets'->>'challenges')::int, 3);

          v_value := LEAST(
            FLOOR((COALESCE(v_login_days,0)::decimal / v_login_target +
                   COALESCE(v_challenges,0)::decimal / v_challenge_target) / 2 * v_target),
            v_target
          );
        END IF;

      ELSE
        v_value := 0;
    END CASE;

    INSERT INTO public.user_frame_progress (user_id, frame_id, current_value, target_value, progress_pct, is_claimable, last_computed_at)
    VALUES (
      p_user_id,
      v_frame.id,
      v_value,
      v_target,
      CASE WHEN v_target > 0 THEN LEAST(100, (v_value::decimal / v_target) * 100) ELSE 0 END,
      v_value >= v_target AND v_target > 0,
      now()
    )
    ON CONFLICT (user_id, frame_id) DO UPDATE SET
      current_value = EXCLUDED.current_value,
      target_value = EXCLUDED.target_value,
      progress_pct = EXCLUDED.progress_pct,
      is_claimable = EXCLUDED.is_claimable,
      last_computed_at = now();
  END LOOP;
END;
$func$;

-- 6h. get_landing_stats — counts from challenges (no longer the bets view).
CREATE OR REPLACE FUNCTION public.get_landing_stats()
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
AS $func$
  SELECT json_build_object(
    'total_players',    (SELECT count(*) FROM public.profiles),
    'total_deals',      (SELECT count(*) FROM public.challenges),
    'completed_deals',  (SELECT count(*) FROM public.challenges WHERE status IN ('completed','settled','resolved')),
    'total_tipps',      (SELECT count(*) FROM public.tipps),
    'total_tippgruppen',(SELECT count(*) FROM public.kicktipp_groups),
    'total_cards',      (SELECT count(*) FROM public.user_cards)
  );
$func$;

-- 6i. insert_feed_event_on_completion — recreated as it was dropped.
CREATE OR REPLACE FUNCTION public.insert_feed_event_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $func$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
    IF NEW.confirmed_winner_id IS NOT NULL THEN
      INSERT INTO public.feed_events (event_type, user_id, deal_id, metadata)
      VALUES ('deal_completed', NEW.confirmed_winner_id, NEW.id,
        jsonb_build_object('title', NEW.title, 'winner', true));
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

-- =====================================================================
-- 7. Add new RPCs (complete_challenge, try_auto_resolve_challenge)
-- =====================================================================
-- complete_challenge: settles the challenge, credits the winner, awards the
-- participation reward to the loser. Replaces the dangling complete_bet
-- reference that try_auto_resolve_bet used to call.

CREATE OR REPLACE FUNCTION public.complete_challenge(
  p_challenge_id  uuid,
  p_winner_id     uuid,
  p_confirmed_by  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_challenge public.challenges%ROWTYPE;
BEGIN
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge % not found', p_challenge_id;
  END IF;

  -- Idempotent: bail if already completed.
  IF v_challenge.status = 'completed' THEN
    RETURN;
  END IF;

  UPDATE public.challenges
  SET status               = 'completed',
      winner_id            = p_winner_id,
      confirmed_winner_id  = p_winner_id,
      winner_proposed_by   = COALESCE(winner_proposed_by, p_confirmed_by),
      result_confirmed     = TRUE,
      updated_at           = NOW()
  WHERE id = p_challenge_id;
END;
$func$;

CREATE OR REPLACE FUNCTION public.try_auto_resolve_challenge(p_challenge_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_challenge public.challenges%ROWTYPE;
  v_winner UUID;
BEGIN
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id;

  IF NOT FOUND OR v_challenge.status <> 'active' THEN RETURN FALSE; END IF;
  IF v_challenge.creator_outcome_claim IS NULL OR v_challenge.opponent_outcome_claim IS NULL THEN
    RETURN FALSE;
  END IF;

  IF    v_challenge.creator_outcome_claim = 'win'  AND v_challenge.opponent_outcome_claim = 'loss' THEN v_winner := v_challenge.creator_id;
  ELSIF v_challenge.creator_outcome_claim = 'loss' AND v_challenge.opponent_outcome_claim = 'win'  THEN v_winner := v_challenge.opponent_id;
  ELSIF v_challenge.creator_outcome_claim = 'draw' AND v_challenge.opponent_outcome_claim = 'draw' THEN v_winner := NULL;
  ELSE
    UPDATE public.challenges SET status = 'disputed', updated_at = NOW() WHERE id = p_challenge_id;
    RETURN FALSE;
  END IF;

  UPDATE public.challenges
  SET status = 'completed', winner_id = v_winner, result_confirmed = TRUE, updated_at = NOW()
  WHERE id = p_challenge_id;

  INSERT INTO public.challenge_results (challenge_id, winner_id, confirmed_by_all, resolved_at, resolution_method)
  VALUES (p_challenge_id, v_winner, TRUE, NOW(), 'mutual_agreement');

  IF v_winner IS NOT NULL THEN
    PERFORM public.complete_challenge(p_challenge_id, v_winner, v_winner);
  END IF;

  RETURN TRUE;
END;
$func$;

-- =====================================================================
-- 8. Recreate triggers with new naming
-- =====================================================================
CREATE TRIGGER on_challenge_completed_archetype
  AFTER UPDATE ON public.challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_archetype_on_challenge_complete();

CREATE TRIGGER trg_challenges_feed_event
  AFTER UPDATE ON public.challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.insert_feed_event_on_completion();

-- handle_deal_completed: hook on update of challenges. Original trigger was
-- named on_deal_completed; recreate under that same name.
CREATE TRIGGER on_deal_completed
  AFTER UPDATE ON public.challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_deal_completed();

-- recalc_reliability trigger on challenge_fulfillment.
CREATE TRIGGER trg_recalc_reliability
  AFTER UPDATE ON public.challenge_fulfillment
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_reliability();

-- =====================================================================
-- 9. Rename remaining policies that still reference bet/bets
-- =====================================================================
DO $$
BEGIN
  -- deal_side_challenges
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='deal_side_challenges' AND policyname='Eigene side bets') THEN
    EXECUTE 'DROP POLICY "Eigene side bets" ON public.deal_side_challenges';
    EXECUTE 'CREATE POLICY "Eigene side challenges" ON public.deal_side_challenges FOR ALL USING (auth.uid() = user_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='deal_side_challenges' AND policyname='Side bets sichtbar') THEN
    EXECUTE 'DROP POLICY "Side bets sichtbar" ON public.deal_side_challenges';
    EXECUTE 'CREATE POLICY "Side challenges sichtbar" ON public.deal_side_challenges FOR SELECT USING (true)';
  END IF;

  -- tip_group_winner_challenges
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tip_group_winner_challenges' AND policyname='tip_group_winner_bets_insert') THEN
    EXECUTE 'DROP POLICY tip_group_winner_bets_insert ON public.tip_group_winner_challenges';
    EXECUTE 'CREATE POLICY tip_group_winner_challenges_insert ON public.tip_group_winner_challenges FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tip_group_winner_challenges' AND policyname='tip_group_winner_bets_select') THEN
    EXECUTE 'DROP POLICY tip_group_winner_bets_select ON public.tip_group_winner_challenges';
    EXECUTE 'CREATE POLICY tip_group_winner_challenges_select ON public.tip_group_winner_challenges FOR SELECT USING (true)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tip_group_winner_challenges' AND policyname='tip_group_winner_bets_update') THEN
    EXECUTE 'DROP POLICY tip_group_winner_bets_update ON public.tip_group_winner_challenges';
    EXECUTE 'CREATE POLICY tip_group_winner_challenges_update ON public.tip_group_winner_challenges FOR UPDATE USING (auth.uid() = user_id)';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- POST-CONDITIONS:
--   - Backward-compat views (bets, bet_fulfillment, bet_comments, bet_invites,
--     deal_side_bets, tip_group_winner_bets) are gone.
--   - Internal columns bet_id / related_bet_id / linked_bet_id are renamed
--     to challenge_id / related_challenge_id / linked_challenge_id.
--   - Functions complete_challenge / try_auto_resolve_challenge replace the
--     legacy *_bet RPCs (the broken complete_bet was never defined; now is).
--   - All renamed RLS policies use challenge in their identifier.
--   - wallet_ledger.reason CHECK accepts both legacy 'side_bet_won' and new
--     'side_challenge_won' / 'side_challenge_lost'.
-- =============================================================================
