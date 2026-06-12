-- =============================================================================
-- MIGRATION: DealBuddy WM 2026 — iPhone-Cup (offizielles Gewinnspiel)
-- =============================================================================
-- Erweitert tip_groups um Felder für offizielle Gewinnspiele und legt die
-- offizielle WM-2026-Tipprunde als Seed an. Eine Tipprunde mit is_official=true
-- bekommt im UI Hero-Treatment und kann nicht editiert/gelöscht werden.
--
-- Veranstalter: Comms Connect GmbH
-- Preise:       1. Platz Apple iPhone 17 Pro Max 256 GB (UVP 1.499 EUR)
--               2. Platz Apple iPhone 17e             (UVP   599 EUR)
--               3. Platz Apple Watch Series 11        (UVP   449 EUR)
-- Zeitraum:     11.06.2026 – 19.07.2026 (FIFA WM 2026 USA/CAN/MEX)
-- Steuer:       § 37b EStG pauschal vom Veranstalter
-- Tie-Breaker:  1. Tor-Differenz Finale, 2. Verlosung unter Gleichplatzierten
-- =============================================================================

BEGIN;

-- 1. tip_groups: optionale Gewinnspiel-Spalten
ALTER TABLE public.tip_groups
  ADD COLUMN IF NOT EXISTS is_official          boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prize_label          text,
  ADD COLUMN IF NOT EXISTS prize_value_cents    integer,
  ADD COLUMN IF NOT EXISTS prize_image_url      text,
  ADD COLUMN IF NOT EXISTS prize_2nd_label      text,
  ADD COLUMN IF NOT EXISTS prize_2nd_value_cents integer,
  ADD COLUMN IF NOT EXISTS prize_3rd_label      text,
  ADD COLUMN IF NOT EXISTS prize_3rd_value_cents integer,
  ADD COLUMN IF NOT EXISTS runner_up_user_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS third_place_user_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contest_starts_at    timestamptz,
  ADD COLUMN IF NOT EXISTS contest_ends_at      timestamptz,
  ADD COLUMN IF NOT EXISTS tie_breaker_question text,
  ADD COLUMN IF NOT EXISTS terms_url            text,
  ADD COLUMN IF NOT EXISTS organizer_name       text,
  ADD COLUMN IF NOT EXISTS winner_user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winner_announced_at  timestamptz;

CREATE INDEX IF NOT EXISTS idx_tip_groups_official
  ON public.tip_groups (is_official)
  WHERE is_official = true;

-- 2. Per-Member-Tipps für Tie-Breaker (Tor-Differenz Finale).
--    NULLable: User muss nicht beim Beitritt tippen, kann nachträglich setzen.
ALTER TABLE public.tip_group_members
  ADD COLUMN IF NOT EXISTS tie_breaker_answer integer,
  ADD COLUMN IF NOT EXISTS joined_at          timestamptz NOT NULL DEFAULT now();

-- 3. RLS: offizielle Gewinnspiele sind immer öffentlich lesbar
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'tip_groups'
      AND policyname = 'tip_groups_official_public_read'
  ) THEN
    CREATE POLICY tip_groups_official_public_read
      ON public.tip_groups
      FOR SELECT
      USING (is_official = true);
  END IF;
END $$;

-- 4. Offizielle Gewinnspiel-Tipprunde seeden.
--    created_by zeigt auf den ältesten Admin (Rainer) — fällt zurück auf NULL
--    wenn kein Profile existiert (defensiv; Live-DB hat ihn).
DO $$
DECLARE
  v_admin_id uuid;
  v_existing uuid;
BEGIN
  -- Schon vorhanden? Idempotent.
  SELECT id INTO v_existing
  FROM public.tip_groups
  WHERE invite_code = 'DEAL-WM2026';

  IF v_existing IS NOT NULL THEN
    RETURN;
  END IF;

  -- Ersten Admin als Owner verwenden (Profile-Tabelle hat keine 'role',
  -- daher älteste registrierte Profile-ID als Eigentümer der offiziellen Gruppe).
  SELECT id INTO v_admin_id
  FROM public.profiles
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO public.tip_groups (
    name,
    description,
    category,
    league,
    competition_code,
    competition_name,
    competition_type,
    season_year,
    auto_sync,
    stake,
    invite_code,
    is_public,
    is_official,
    created_by,
    max_members,
    status,
    prize_label,
    prize_value_cents,
    prize_image_url,
    prize_2nd_label,
    prize_2nd_value_cents,
    prize_3rd_label,
    prize_3rd_value_cents,
    contest_starts_at,
    contest_ends_at,
    tie_breaker_question,
    terms_url,
    organizer_name
  ) VALUES (
    'WM 2026 — iPhone-Cup',
    'Offizielles DealBuddy-Gewinnspiel zur FIFA WM 2026. Tippe alle Spiele mit, sammle Punkte. 1. Platz iPhone 17 Pro Max, 2. Platz iPhone 17e, 3. Platz Apple Watch Series 11.',
    'football',
    'WC',
    'WC',
    'WM',
    'TOURNAMENT',
    '2026',
    true,
    'Apple iPhone 17 Pro Max 256 GB · Apple iPhone 17e · Apple Watch Series 11',
    'DEAL-WM2026',
    true,
    true,
    v_admin_id,
    100000,            -- effektiv unlimitiert
    'active',
    'Apple iPhone 17 Pro Max 256 GB',
    149900,            -- 1.499,00 EUR in Cent
    '/gewinnspiel/iphone-17-pro-max.png',
    'Apple iPhone 17e',
    59900,             --   599,00 EUR in Cent
    'Apple Watch Series 11',
    44900,             --   449,00 EUR in Cent
    '2026-06-11 18:00:00+02',
    '2026-07-19 23:59:59+02',
    'Tor-Differenz im WM-Finale (z.B. 3 für ein 3:0). Bei weiterhin gleichem Stand entscheidet eine Verlosung unter den Gleichplatzierten.',
    '/app/gewinnspiel/teilnahmebedingungen',
    'Comms Connect GmbH'
  );
END $$;

COMMIT;
