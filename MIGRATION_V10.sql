-- ============================================================
-- MIGRATION_V10.sql — Tippgruppen Kicktipp-Level Overhaul
-- Run in Supabase SQL Editor AFTER all previous migrations
-- ============================================================

-- ──────────────────────────────────────────────
-- 1A. ALTER tip_groups — Scoring config + API sync
-- ──────────────────────────────────────────────
ALTER TABLE tip_groups
  ADD COLUMN IF NOT EXISTS points_exact       INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS points_diff        INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS points_tendency    INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS joker_enabled      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS joker_multiplier   INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS joker_per_matchday INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS competition_id     INTEGER,
  ADD COLUMN IF NOT EXISTS competition_code   TEXT,
  ADD COLUMN IF NOT EXISTS competition_name   TEXT,
  ADD COLUMN IF NOT EXISTS competition_type   TEXT DEFAULT 'LEAGUE',
  ADD COLUMN IF NOT EXISTS season_year        TEXT,
  ADD COLUMN IF NOT EXISTS auto_sync          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at     TIMESTAMPTZ;

-- Add check constraint for competition_type (separate so IF NOT EXISTS works)
DO $$ BEGIN
  ALTER TABLE tip_groups ADD CONSTRAINT tip_groups_competition_type_check
    CHECK (competition_type IN ('LEAGUE','CUP','TOURNAMENT'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────
-- 1B. ALTER tip_questions — Match metadata + live
-- ──────────────────────────────────────────────
ALTER TABLE tip_questions
  ADD COLUMN IF NOT EXISTS match_utc_date    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS match_status      TEXT DEFAULT 'SCHEDULED',
  ADD COLUMN IF NOT EXISTS match_minute      INTEGER,
  ADD COLUMN IF NOT EXISTS halftime_home     INTEGER,
  ADD COLUMN IF NOT EXISTS halftime_away     INTEGER,
  ADD COLUMN IF NOT EXISTS home_team_short   TEXT,
  ADD COLUMN IF NOT EXISTS away_team_short   TEXT,
  ADD COLUMN IF NOT EXISTS competition_stage TEXT,
  ADD COLUMN IF NOT EXISTS group_label       TEXT,
  ADD COLUMN IF NOT EXISTS is_live           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_updated_at   TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tip_questions_live ON tip_questions(is_live) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_tip_questions_matchday ON tip_questions(group_id, matchday);
CREATE INDEX IF NOT EXISTS idx_tip_questions_api_id ON tip_questions(match_api_id);

-- ──────────────────────────────────────────────
-- 1C. ALTER tip_group_members — Per-matchday tracking
-- ──────────────────────────────────────────────
ALTER TABLE tip_group_members
  ADD COLUMN IF NOT EXISTS jokers_used_matchdays JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS points_by_matchday    JSONB DEFAULT '{}'::JSONB;

-- Fix joker default from 1 to 3
ALTER TABLE tip_group_members ALTER COLUMN jokers_remaining SET DEFAULT 3;

-- ──────────────────────────────────────────────
-- 1D. CREATE tip_bonus_questions + tip_bonus_answers
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tip_bonus_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES tip_groups(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer_type TEXT NOT NULL DEFAULT 'single_choice'
    CHECK (answer_type IN ('single_choice','multi_choice','freetext','number')),
  options JSONB,
  correct_answer TEXT,
  points INTEGER NOT NULL DEFAULT 5,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed','resolved')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tip_bonus_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES tip_bonus_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, user_id)
);

-- ──────────────────────────────────────────────
-- 1E. CREATE tip_bracket_tips (KO tournaments)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tip_bracket_tips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES tip_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  position INTEGER NOT NULL,
  predicted_team_name TEXT,
  actual_team_name TEXT,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id, stage, position)
);

-- ──────────────────────────────────────────────
-- 2. RLS Policies
-- ──────────────────────────────────────────────

-- Enable RLS on new tables
ALTER TABLE tip_bonus_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_bonus_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_bracket_tips ENABLE ROW LEVEL SECURITY;

-- tip_bonus_questions: anyone in group can SELECT, admin can INSERT/UPDATE/DELETE
CREATE POLICY "bonus_questions_select" ON tip_bonus_questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tip_group_members WHERE group_id = tip_bonus_questions.group_id AND user_id = auth.uid())
  );

CREATE POLICY "bonus_questions_insert" ON tip_bonus_questions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM tip_group_members WHERE group_id = tip_bonus_questions.group_id AND user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "bonus_questions_update" ON tip_bonus_questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM tip_group_members WHERE group_id = tip_bonus_questions.group_id AND user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "bonus_questions_delete" ON tip_bonus_questions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM tip_group_members WHERE group_id = tip_bonus_questions.group_id AND user_id = auth.uid() AND role = 'admin')
  );

-- tip_bonus_answers: members can SELECT all in group, INSERT/UPDATE own
CREATE POLICY "bonus_answers_select" ON tip_bonus_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tip_bonus_questions bq
      JOIN tip_group_members gm ON gm.group_id = bq.group_id
      WHERE bq.id = tip_bonus_answers.question_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "bonus_answers_insert" ON tip_bonus_answers
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "bonus_answers_update" ON tip_bonus_answers
  FOR UPDATE USING (user_id = auth.uid());

-- tip_bracket_tips: members can SELECT all in group, INSERT/UPDATE own
CREATE POLICY "bracket_tips_select" ON tip_bracket_tips
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tip_group_members WHERE group_id = tip_bracket_tips.group_id AND user_id = auth.uid())
  );

CREATE POLICY "bracket_tips_insert" ON tip_bracket_tips
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "bracket_tips_update" ON tip_bracket_tips
  FOR UPDATE USING (user_id = auth.uid());

-- ──────────────────────────────────────────────
-- 3. Enable Realtime for new tables
-- ──────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE tip_bonus_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE tip_bonus_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE tip_bracket_tips;

-- ──────────────────────────────────────────────
-- DONE ✅
-- ──────────────────────────────────────────────
