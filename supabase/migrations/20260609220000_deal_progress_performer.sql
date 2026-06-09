-- Optionaler Performer pro Deal: wenn gesetzt, gibt es nur EINE Reihe
-- Kästchen (für diese Person), und nur diese Person darf toggeln.
-- Ohne performer_id bleibt das 2-Reihen-Race-Verhalten erhalten.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS performer_id UUID NULL REFERENCES public.profiles(id);

ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_performer_is_participant;
ALTER TABLE public.challenges ADD CONSTRAINT challenges_performer_is_participant
  CHECK (performer_id IS NULL OR performer_id = creator_id OR performer_id = opponent_id);

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
  IF v_row.performer_id IS NOT NULL AND v_row.performer_id <> v_user THEN
    RAISE EXCEPTION 'not_the_performer';
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
