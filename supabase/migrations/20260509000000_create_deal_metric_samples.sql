-- =============================================================================
-- MIGRATION: deal_metric_samples — live progress tracking for active challenges
-- =============================================================================
-- Stores cumulative metric readings (e.g. step counts) reported by participants
-- of a challenge. Enables a live "wer führt" view on the deal detail page.
-- Sources today: 'manual'. Future: 'healthkit', 'health_connect', 'strava',
-- 'fitbit' — once the native Expo app and OAuth integrations are wired up.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.deal_metric_samples (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      uuid        NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  metric       text        NOT NULL,
  value        numeric     NOT NULL CHECK (value >= 0),
  source       text        NOT NULL DEFAULT 'manual',
  sampled_at   timestamptz NOT NULL DEFAULT now(),
  received_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_metric_samples_dedup UNIQUE (deal_id, user_id, metric, sampled_at)
);

CREATE INDEX IF NOT EXISTS deal_metric_samples_latest_idx
  ON public.deal_metric_samples (deal_id, user_id, metric, sampled_at DESC);

ALTER TABLE public.deal_metric_samples ENABLE ROW LEVEL SECURITY;

-- Participants of the deal (creator or opponent) can read all samples.
DROP POLICY IF EXISTS "deal_metric_samples_select_participants" ON public.deal_metric_samples;
CREATE POLICY "deal_metric_samples_select_participants"
  ON public.deal_metric_samples
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = deal_metric_samples.deal_id
        AND (c.creator_id = auth.uid() OR c.opponent_id = auth.uid())
    )
  );

-- A user can only insert samples for themselves, and only if they are a
-- participant of the deal.
DROP POLICY IF EXISTS "deal_metric_samples_insert_self" ON public.deal_metric_samples;
CREATE POLICY "deal_metric_samples_insert_self"
  ON public.deal_metric_samples
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = deal_metric_samples.deal_id
        AND (c.creator_id = auth.uid() OR c.opponent_id = auth.uid())
    )
  );

-- Realtime: deal detail page subscribes to live updates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'deal_metric_samples'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_metric_samples;
  END IF;
END $$;

COMMIT;
