-- Bug: bei OFFENEN Deals (opponent_id=NULL) konnte der Empfänger nicht
-- accepten — RLS-Policy 'Participants update challenges' erlaubt UPDATE
-- nur wenn auth.uid()=creator_id OR auth.uid()=opponent_id; bei NULL
-- opponent_id schlug der Vergleich fehl. accept() im Frontend fing den
-- Fehler still in catch(_err) ab → für den User passierte nichts.

CREATE OR REPLACE FUNCTION public.accept_open_challenge(p_challenge_id UUID)
RETURNS public.challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row  public.challenges;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_row FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge_not_found';
  END IF;
  IF v_row.status <> 'open' THEN
    RAISE EXCEPTION 'challenge_not_open';
  END IF;
  IF v_row.opponent_id IS NOT NULL THEN
    RAISE EXCEPTION 'challenge_already_has_opponent';
  END IF;
  IF v_row.creator_id = v_user THEN
    RAISE EXCEPTION 'cannot_accept_own_challenge';
  END IF;
  IF COALESCE(v_row.is_public, true) = false THEN
    RAISE EXCEPTION 'challenge_not_public';
  END IF;

  UPDATE public.challenges
  SET opponent_id = v_user,
      status = 'active',
      accepted_at = now(),
      shared_as_story_at = COALESCE(shared_as_story_at, now())
  WHERE id = p_challenge_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_open_challenge(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_open_challenge(UUID) TO authenticated;

-- Begleitfix: feed_events_event_type_check kannte 'challenge_joined' und
-- 'result_proposed' nicht, obwohl das Frontend sie inserten will.
ALTER TABLE public.feed_events DROP CONSTRAINT IF EXISTS feed_events_event_type_check;
ALTER TABLE public.feed_events ADD CONSTRAINT feed_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'deal_created','deal_accepted','deal_completed','deal_media_added','deal_story',
    'streak_milestone','level_up','badge_earned','rivalry_update','spotlight',
    'tip_result','tip_exact','tip_group_created','tip_group_story',
    'challenge_joined','result_proposed'
  ]));
