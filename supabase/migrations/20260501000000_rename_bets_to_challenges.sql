-- =============================================================================
-- MIGRATION: Rename bets/bet_* tables to challenges/challenge_* for compliance
-- =============================================================================
-- Rationale: DealBuddy must not be positioned as gambling. The user-facing UI
-- already uses "challenge"/"deal"/"match", but the underlying schema still
-- reads as "bets". This migration aligns the schema with the product language.
--
-- Strategy (intentionally conservative):
--   1. Rename the tables (data + triggers + RLS + simple-FK metadata follow).
--   2. Rename FK constraints + indexes that contain "bet" so PostgREST embeds
--      stay consistent.
--   3. Rename RLS policies (drop + recreate with same logic) to remove the
--      "bet" wording from policy names.
--   4. Create backward-compatibility VIEWs with the OLD table names so any
--      caller that still says ".from('bets')" keeps working until a follow-up
--      migration drops them. The views are auto-updateable in Postgres because
--      each is a plain "SELECT * FROM <renamed_table>" against a single base
--      table with no aggregates or joins, so INSERT/UPDATE/DELETE through the
--      view rewrites to the base table.
--   5. Internal columns like "bet_id" inside fulfillment / debt_ledger /
--      xp_events are LEFT IN PLACE for now to keep the views cleanly
--      auto-updateable. A follow-up migration will rename those columns once
--      all callers are updated.
--
-- Idempotent: re-running this migration is a no-op.
-- =============================================================================

BEGIN;

-- ---------- 1. Rename core tables ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bets')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='challenges') THEN
    ALTER TABLE public.bets RENAME TO challenges;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bet_fulfillment')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='challenge_fulfillment') THEN
    ALTER TABLE public.bet_fulfillment RENAME TO challenge_fulfillment;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bet_comments')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='challenge_comments') THEN
    ALTER TABLE public.bet_comments RENAME TO challenge_comments;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bet_invites')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='challenge_invites') THEN
    ALTER TABLE public.bet_invites RENAME TO challenge_invites;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='deal_side_bets')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='deal_side_challenges') THEN
    ALTER TABLE public.deal_side_bets RENAME TO deal_side_challenges;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tip_group_winner_bets')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tip_group_winner_challenges') THEN
    ALTER TABLE public.tip_group_winner_bets RENAME TO tip_group_winner_challenges;
  END IF;
END $$;

-- ---------- 2. Rename FK constraints (so PostgREST embeds use new names) ----------
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
      AND (c.conname LIKE 'bets\_%' ESCAPE '\'
           OR c.conname LIKE 'bet\_fulfillment\_%' ESCAPE '\'
           OR c.conname LIKE 'bet\_comments\_%' ESCAPE '\'
           OR c.conname LIKE 'bet\_invites\_%' ESCAPE '\'
           OR c.conname LIKE 'deal\_side\_bets\_%' ESCAPE '\'
           OR c.conname LIKE 'tip\_group\_winner\_bets\_%' ESCAPE '\')
  LOOP
    new_name := r.conname;
    new_name := regexp_replace(new_name, '^bets_', 'challenges_');
    new_name := regexp_replace(new_name, '^bet_fulfillment_', 'challenge_fulfillment_');
    new_name := regexp_replace(new_name, '^bet_comments_', 'challenge_comments_');
    new_name := regexp_replace(new_name, '^bet_invites_', 'challenge_invites_');
    new_name := regexp_replace(new_name, '^deal_side_bets_', 'deal_side_challenges_');
    new_name := regexp_replace(new_name, '^tip_group_winner_bets_', 'tip_group_winner_challenges_');

    IF new_name <> r.conname THEN
      EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
                     r.qualified_table, r.conname, new_name);
    END IF;
  END LOOP;
END $$;

-- ---------- 3. Rename indexes ----------
DO $$
DECLARE
  r RECORD;
  new_name TEXT;
BEGIN
  FOR r IN
    SELECT indexname, schemaname
    FROM pg_indexes
    WHERE schemaname='public'
      AND (indexname LIKE 'bets\_%' ESCAPE '\'
           OR indexname LIKE 'bet\_fulfillment\_%' ESCAPE '\'
           OR indexname LIKE 'bet\_comments\_%' ESCAPE '\'
           OR indexname LIKE 'bet\_invites\_%' ESCAPE '\'
           OR indexname LIKE 'idx\_bets\_%' ESCAPE '\'
           OR indexname LIKE 'idx\_bf\_%' ESCAPE '\'
           OR indexname LIKE 'deal\_side\_bets\_%' ESCAPE '\'
           OR indexname LIKE 'tip\_group\_winner\_bets\_%' ESCAPE '\')
  LOOP
    new_name := r.indexname;
    new_name := regexp_replace(new_name, '^bets_', 'challenges_');
    new_name := regexp_replace(new_name, '^bet_fulfillment_', 'challenge_fulfillment_');
    new_name := regexp_replace(new_name, '^bet_comments_', 'challenge_comments_');
    new_name := regexp_replace(new_name, '^bet_invites_', 'challenge_invites_');
    new_name := regexp_replace(new_name, '^idx_bets_', 'idx_challenges_');
    new_name := regexp_replace(new_name, '^idx_bf_', 'idx_cf_');
    new_name := regexp_replace(new_name, '^deal_side_bets_', 'deal_side_challenges_');
    new_name := regexp_replace(new_name, '^tip_group_winner_bets_', 'tip_group_winner_challenges_');

    IF new_name <> r.indexname THEN
      EXECUTE format('ALTER INDEX %I.%I RENAME TO %I',
                     r.schemaname, r.indexname, new_name);
    END IF;
  END LOOP;
END $$;

-- ---------- 4. Rename RLS policies ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='challenges' AND policyname='Bets public read') THEN
    EXECUTE 'DROP POLICY "Bets public read" ON public.challenges';
    EXECUTE 'CREATE POLICY "Challenges public read" ON public.challenges FOR SELECT USING (true)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='challenges' AND policyname='Auth users create bets') THEN
    EXECUTE 'DROP POLICY "Auth users create bets" ON public.challenges';
    EXECUTE 'CREATE POLICY "Auth users create challenges" ON public.challenges FOR INSERT WITH CHECK (auth.uid() = creator_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='challenges' AND policyname='Participants update bets') THEN
    EXECUTE 'DROP POLICY "Participants update bets" ON public.challenges';
    EXECUTE 'CREATE POLICY "Participants update challenges" ON public.challenges FOR UPDATE USING (auth.uid() = creator_id OR auth.uid() = opponent_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='challenge_comments' AND policyname='Bet comments readable') THEN
    EXECUTE 'DROP POLICY "Bet comments readable" ON public.challenge_comments';
    EXECUTE 'CREATE POLICY "Challenge comments readable" ON public.challenge_comments FOR SELECT USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='challenge_fulfillment' AND policyname='Anyone can read bet_fulfillment') THEN
    EXECUTE 'DROP POLICY "Anyone can read bet_fulfillment" ON public.challenge_fulfillment';
    EXECUTE 'CREATE POLICY "Anyone can read challenge_fulfillment" ON public.challenge_fulfillment FOR SELECT USING (true)';
  END IF;

  -- bet_invites schema in production: (id, bet_id, invited_user_id, status,
  -- outcome_claim, created_at). Original policies preserved as-is.
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='challenge_invites' AND policyname='bet_invites_own_select') THEN
    EXECUTE 'DROP POLICY bet_invites_own_select ON public.challenge_invites';
    EXECUTE 'CREATE POLICY challenge_invites_own_select ON public.challenge_invites FOR SELECT USING (invited_user_id = auth.uid())';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='challenge_invites' AND policyname='bet_invites_service') THEN
    EXECUTE 'DROP POLICY bet_invites_service ON public.challenge_invites';
    EXECUTE 'CREATE POLICY challenge_invites_service ON public.challenge_invites FOR ALL USING (true)';
  END IF;
END $$;

-- ---------- 5. Backward-compat VIEWs (keep "bets" addressable until callers are updated) ----------
-- Auto-updateable simple views. INSERT/UPDATE/DELETE through these views are
-- rewritten to the underlying renamed tables by Postgres.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='bets') THEN
    EXECUTE 'CREATE VIEW public.bets AS SELECT * FROM public.challenges';
    EXECUTE 'COMMENT ON VIEW public.bets IS ''Backward-compat alias for challenges. Removed once all callers use challenges.''';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='bet_fulfillment') THEN
    EXECUTE 'CREATE VIEW public.bet_fulfillment AS SELECT * FROM public.challenge_fulfillment';
    EXECUTE 'COMMENT ON VIEW public.bet_fulfillment IS ''Backward-compat alias for challenge_fulfillment. Removed once all callers are updated.''';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='bet_comments') THEN
    EXECUTE 'CREATE VIEW public.bet_comments AS SELECT * FROM public.challenge_comments';
    EXECUTE 'COMMENT ON VIEW public.bet_comments IS ''Backward-compat alias for challenge_comments. Removed once all callers are updated.''';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='bet_invites') THEN
    EXECUTE 'CREATE VIEW public.bet_invites AS SELECT * FROM public.challenge_invites';
    EXECUTE 'COMMENT ON VIEW public.bet_invites IS ''Backward-compat alias for challenge_invites. Removed once all callers are updated.''';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='deal_side_bets') THEN
    EXECUTE 'CREATE VIEW public.deal_side_bets AS SELECT * FROM public.deal_side_challenges';
    EXECUTE 'COMMENT ON VIEW public.deal_side_bets IS ''Backward-compat alias for deal_side_challenges. Removed once all callers are updated.''';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='tip_group_winner_bets') THEN
    EXECUTE 'CREATE VIEW public.tip_group_winner_bets AS SELECT * FROM public.tip_group_winner_challenges';
    EXECUTE 'COMMENT ON VIEW public.tip_group_winner_bets IS ''Backward-compat alias for tip_group_winner_challenges. Removed once all callers are updated.''';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- POST-CONDITIONS:
--   - Tables renamed: bets -> challenges, bet_fulfillment -> challenge_fulfillment,
--     bet_comments -> challenge_comments, bet_invites -> challenge_invites,
--     deal_side_bets -> deal_side_challenges,
--     tip_group_winner_bets -> tip_group_winner_challenges.
--   - FK constraints + indexes + RLS policies use challenge_* names.
--   - Backward-compat views with OLD names continue to serve reads/writes.
--   - Existing functions (handle_deal_completed, recalc_reliability, etc.) keep
--     working: they reference table names which now resolve to the views or to
--     the renamed tables (Postgres rewrites function bodies lazily on next run).
-- =============================================================================
