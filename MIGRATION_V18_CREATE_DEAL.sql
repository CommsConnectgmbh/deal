-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V18 — Create Deal Flow Overhaul
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. deal_templates ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  stake TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'custom',
  icon TEXT NOT NULL DEFAULT '⚡',
  description TEXT NOT NULL DEFAULT '',
  ruleset_type TEXT NOT NULL DEFAULT 'free_text',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE deal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read templates" ON deal_templates FOR SELECT USING (true);
CREATE POLICY "Users can create own templates" ON deal_templates FOR INSERT WITH CHECK (auth.uid() = created_by);

-- ─── 2. deal_series (recurring challenges) ───────────────────
CREATE TABLE IF NOT EXISTS deal_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  stake TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'custom',
  recurrence TEXT NOT NULL DEFAULT 'weekly' CHECK (recurrence IN ('daily', 'weekly', 'monthly')),
  next_deal_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  template_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE deal_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator can manage own series" ON deal_series FOR ALL USING (auth.uid() = creator_id);
CREATE POLICY "Anyone can read active series" ON deal_series FOR SELECT USING (is_active = true);

-- ─── 3. New columns on bets table ───────────────────────────
DO $$
BEGIN
  -- Mode: 1v1, team, open_challenge
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bets' AND column_name='mode') THEN
    ALTER TABLE bets ADD COLUMN mode TEXT NOT NULL DEFAULT '1v1';
  END IF;

  -- Visibility: private, friends, public
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bets' AND column_name='visibility') THEN
    ALTER TABLE bets ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
  END IF;

  -- Join mode for open challenges
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bets' AND column_name='join_mode') THEN
    ALTER TABLE bets ADD COLUMN join_mode TEXT NOT NULL DEFAULT 'open';
  END IF;

  -- Max participants for open challenges
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bets' AND column_name='max_participants') THEN
    ALTER TABLE bets ADD COLUMN max_participants INT NOT NULL DEFAULT 2;
  END IF;

  -- Ruleset type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bets' AND column_name='ruleset_type') THEN
    ALTER TABLE bets ADD COLUMN ruleset_type TEXT NOT NULL DEFAULT 'free_text';
  END IF;

  -- Scoring mode
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bets' AND column_name='scoring_mode') THEN
    ALTER TABLE bets ADD COLUMN scoring_mode TEXT NOT NULL DEFAULT 'manual';
  END IF;

  -- Series reference
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bets' AND column_name='series_id') THEN
    ALTER TABLE bets ADD COLUMN series_id UUID REFERENCES deal_series(id) ON DELETE SET NULL;
  END IF;

  -- Template reference
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bets' AND column_name='template_id') THEN
    ALTER TABLE bets ADD COLUMN template_id UUID REFERENCES deal_templates(id) ON DELETE SET NULL;
  END IF;

  -- Parent deal (for rematch/clone)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bets' AND column_name='parent_deal_id') THEN
    ALTER TABLE bets ADD COLUMN parent_deal_id UUID REFERENCES bets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 4. deal_teams ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL DEFAULT 'Team',
  team_color TEXT NOT NULL DEFAULT '#FFB800',
  team_side TEXT NOT NULL DEFAULT 'a' CHECK (team_side IN ('a', 'b')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE deal_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can read teams" ON deal_teams FOR SELECT USING (true);
CREATE POLICY "Creator can manage teams" ON deal_teams FOR ALL USING (
  EXISTS (SELECT 1 FROM bets WHERE bets.id = deal_teams.deal_id AND bets.creator_id = auth.uid())
);

-- ─── 5. deal_participants ───────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES deal_teams(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('creator', 'participant')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'eliminated', 'left')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, user_id)
);
ALTER TABLE deal_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read participants" ON deal_participants FOR SELECT USING (true);
CREATE POLICY "Users can join deals" ON deal_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own status" ON deal_participants FOR UPDATE USING (auth.uid() = user_id);

-- ─── 6. Seed system templates ───────────────────────────────
INSERT INTO deal_templates (title, stake, category, icon, description, ruleset_type, is_system) VALUES
  ('Liegestuetze-Duell', '20 Liegestuetze', 'fitness', '💪', 'Wer schafft mehr Liegestuetze in 1 Minute?', 'score_based', true),
  ('Vorhersage', 'Kasten Bier', 'prediction', '🔮', 'Wer hat recht? Tippe auf das Ergebnis.', 'prediction', true),
  ('Lauf-Challenge', '5km unter 25 Min', 'fitness', '🏃', 'Wer laeuft schneller?', 'target', true),
  ('Fussball-Tipp', 'Abendessen zahlen', 'sport', '⚽', 'Wer tippt das Ergebnis richtig?', 'prediction', true),
  ('Quiz-Duell', 'Runde ausgeben', 'wissen', '🧠', '10 Fragen — wer weiss mehr?', 'score_based', true),
  ('Gewohnheits-Streak', '30 Tage durchhalten', 'lifestyle', '🎯', 'Wer haelt laenger durch?', 'countdown', true),
  ('Peinliches Foto', 'Peinliches Foto posten', 'fun', '📸', 'Verlierer postet ein peinliches Foto!', 'free_text', true),
  ('Einfache Wette', 'Kasten Bier', 'fun', '🎲', 'Wer hat recht? Einfache Wette.', 'free_text', true)
ON CONFLICT DO NOTHING;

-- ─── Done ───────────────────────────────────────────────────
-- Run this migration in Supabase SQL Editor
-- Then proceed with the frontend implementation
