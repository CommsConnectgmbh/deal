-- MIGRATION_RELIABILITY.sql
-- Deal Reliability Score + Opponent Filter
-- Run in Supabase SQL Editor

-- ═══ 1. bet_fulfillment table ═══
CREATE TABLE IF NOT EXISTS bet_fulfillment (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id                UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  obligated_user_id     UUID NOT NULL REFERENCES profiles(id),
  entitled_user_id      UUID NOT NULL REFERENCES profiles(id),
  status                TEXT NOT NULL DEFAULT 'pending_fulfillment'
                          CHECK (status IN (
                            'pending_fulfillment',
                            'fulfilled',
                            'unfulfilled',
                            'expired'
                          )),
  confirmed_by_user_id  UUID REFERENCES profiles(id),
  confirmed_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bet_id)
);

CREATE INDEX IF NOT EXISTS idx_bf_bet_id ON bet_fulfillment(bet_id);
CREATE INDEX IF NOT EXISTS idx_bf_obligated ON bet_fulfillment(obligated_user_id);
CREATE INDEX IF NOT EXISTS idx_bf_entitled ON bet_fulfillment(entitled_user_id);
CREATE INDEX IF NOT EXISTS idx_bf_status ON bet_fulfillment(status);
CREATE INDEX IF NOT EXISTS idx_bf_expires ON bet_fulfillment(expires_at);

-- ═══ 2. Reliability columns on profiles ═══
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  reliability_fulfilled_count   INT NOT NULL DEFAULT 0;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  reliability_unfulfilled_count INT NOT NULL DEFAULT 0;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  reliability_score             NUMERIC(4,3);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  reliability_color             TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  reliability_updated_at        TIMESTAMPTZ;

-- ═══ 3. Opponent Filter columns on profiles ═══
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  opponent_filter_enabled       BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  opponent_min_reliability      INT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  opponent_require_confirmation BOOLEAN NOT NULL DEFAULT false;

-- ═══ 4. Trigger function: recalculate reliability on fulfillment status change ═══
CREATE OR REPLACE FUNCTION recalc_reliability()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID := NEW.obligated_user_id;
  v_fulfilled INT;
  v_unfulfilled INT;
  v_relevant INT;
  v_score NUMERIC(4,3);
  v_color TEXT;
BEGIN
  -- Only fire on final status transitions
  IF NEW.status NOT IN ('fulfilled', 'unfulfilled') THEN
    RETURN NEW;
  END IF;

  -- Recount from source of truth
  SELECT
    count(*) FILTER (WHERE status = 'fulfilled'),
    count(*) FILTER (WHERE status = 'unfulfilled')
  INTO v_fulfilled, v_unfulfilled
  FROM bet_fulfillment
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

  UPDATE profiles SET
    reliability_fulfilled_count   = v_fulfilled,
    reliability_unfulfilled_count = v_unfulfilled,
    reliability_score             = v_score,
    reliability_color             = v_color,
    reliability_updated_at        = now()
  WHERE id = v_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ 5. Attach trigger ═══
DROP TRIGGER IF EXISTS trg_recalc_reliability ON bet_fulfillment;
CREATE TRIGGER trg_recalc_reliability
  AFTER UPDATE OF status ON bet_fulfillment
  FOR EACH ROW
  EXECUTE FUNCTION recalc_reliability();

-- ═══ 6. RLS Policies ═══
ALTER TABLE bet_fulfillment ENABLE ROW LEVEL SECURITY;

-- Everyone can read fulfillment records (needed for profile badge)
CREATE POLICY "Anyone can read bet_fulfillment"
  ON bet_fulfillment FOR SELECT
  USING (true);

-- Only the entitled user (winner) can update status
CREATE POLICY "Entitled user can update fulfillment"
  ON bet_fulfillment FOR UPDATE
  USING (auth.uid() = entitled_user_id)
  WITH CHECK (
    auth.uid() = entitled_user_id
    AND status = 'pending_fulfillment'  -- can only transition FROM pending
  );

-- Insert only via service role (edge function / API route)
-- No public INSERT policy = only service_role can insert

-- ═══ 7. updated_at auto-trigger ═══
CREATE OR REPLACE FUNCTION update_bf_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bf_updated_at ON bet_fulfillment;
CREATE TRIGGER trg_bf_updated_at
  BEFORE UPDATE ON bet_fulfillment
  FOR EACH ROW
  EXECUTE FUNCTION update_bf_updated_at();
