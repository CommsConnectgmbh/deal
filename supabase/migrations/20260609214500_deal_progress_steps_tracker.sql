-- Pro Challenge optional einen Schritt-Zähler (1..target_steps).
-- Beide Teilnehmer haben je eine eigene Reihe Häkchen; Live-Sync via
-- Supabase Realtime auf deal_progress_steps.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS target_steps INT NOT NULL DEFAULT 1
    CHECK (target_steps >= 1 AND target_steps <= 100);

CREATE TABLE IF NOT EXISTS public.deal_progress_steps (
  deal_id      UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  step_index   INT  NOT NULL CHECK (step_index >= 1 AND step_index <= 100),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_id, user_id, step_index)
);

CREATE INDEX IF NOT EXISTS deal_progress_steps_deal_idx
  ON public.deal_progress_steps (deal_id);

ALTER TABLE public.deal_progress_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "progress_select_participant_or_public" ON public.deal_progress_steps;
CREATE POLICY "progress_select_participant_or_public"
ON public.deal_progress_steps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = deal_progress_steps.deal_id
      AND (c.is_public = true
           OR c.creator_id = (SELECT auth.uid())
           OR c.opponent_id = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "progress_no_direct_write" ON public.deal_progress_steps;
CREATE POLICY "progress_no_direct_write"
ON public.deal_progress_steps FOR ALL TO authenticated
USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.toggle_deal_step(p_deal_id UUID, p_step_index INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_row   public.challenges;
  v_now_done BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.challenges WHERE id = p_deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'deal_not_found'; END IF;
  IF v_user <> v_row.creator_id AND v_user <> v_row.opponent_id THEN
    RAISE EXCEPTION 'not_a_participant';
  END IF;
  IF v_row.status NOT IN ('active','pending_confirmation','open') THEN
    RAISE EXCEPTION 'deal_not_active';
  END IF;
  IF p_step_index < 1 OR p_step_index > COALESCE(v_row.target_steps,1) THEN
    RAISE EXCEPTION 'step_out_of_range';
  END IF;

  DELETE FROM public.deal_progress_steps
   WHERE deal_id = p_deal_id AND user_id = v_user AND step_index = p_step_index;

  IF FOUND THEN
    v_now_done := false;
  ELSE
    INSERT INTO public.deal_progress_steps (deal_id, user_id, step_index)
    VALUES (p_deal_id, v_user, p_step_index);
    v_now_done := true;
  END IF;

  RETURN v_now_done;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_deal_step(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_deal_step(UUID, INT) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='deal_progress_steps'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_progress_steps';
  END IF;
END$$;
