-- Vorher: 26 von 27 Profilen hatten invite_code=NULL → der WhatsApp-
-- Invite-Link im Welcome-Onboarding sendete /join/{code} mit leerem Code,
-- die /join-Route konnte den Sender nicht auflösen und es passierte
-- nichts. Fix: Generator + BEFORE-INSERT-Trigger + Backfill.

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_chars CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code TEXT;
  v_attempts INTEGER := 0;
BEGIN
  LOOP
    v_code := 'DEAL-' || string_agg(substr(v_chars, 1 + floor(random()*length(v_chars))::int, 1), '')
              FROM generate_series(1,5);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE invite_code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'could_not_generate_unique_invite_code';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_set_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := public.generate_invite_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_invite_code ON public.profiles;
CREATE TRIGGER trg_profiles_set_invite_code
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_set_invite_code();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_invite_code_unique
  ON public.profiles (invite_code)
  WHERE invite_code IS NOT NULL;

UPDATE public.profiles
SET invite_code = public.generate_invite_code()
WHERE invite_code IS NULL;
