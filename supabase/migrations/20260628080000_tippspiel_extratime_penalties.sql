-- K.o.-Endergebnis inkl. Verlängerung & Elfmeterschießen.
-- Wird von sync-league-matches/update-live-scores aus
-- football-data.org-Score-Daten gefüllt; resolve-matchday bewertet
-- exact/diff weiter auf 90', Tendenz auf match_winner (Gesamtsieger inkl. E11m).
ALTER TABLE public.tip_questions
  ADD COLUMN IF NOT EXISTS extratime_home INTEGER,
  ADD COLUMN IF NOT EXISTS extratime_away INTEGER,
  ADD COLUMN IF NOT EXISTS penalty_home   INTEGER,
  ADD COLUMN IF NOT EXISTS penalty_away   INTEGER,
  ADD COLUMN IF NOT EXISTS match_duration TEXT,
  ADD COLUMN IF NOT EXISTS match_winner   TEXT;

COMMENT ON COLUMN public.tip_questions.extratime_home IS 'Tore Heim nach Verlängerung (kumulativ, inkl. regulärer Zeit)';
COMMENT ON COLUMN public.tip_questions.extratime_away IS 'Tore Auswärts nach Verlängerung (kumulativ, inkl. regulärer Zeit)';
COMMENT ON COLUMN public.tip_questions.penalty_home   IS 'Elfmeterschießen Heim';
COMMENT ON COLUMN public.tip_questions.penalty_away   IS 'Elfmeterschießen Auswärts';
COMMENT ON COLUMN public.tip_questions.match_duration IS 'REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT (football-data.org score.duration)';
COMMENT ON COLUMN public.tip_questions.match_winner   IS 'HOME_TEAM | AWAY_TEAM | DRAW (Gesamtsieger inkl. Elfmeterschießen)';
