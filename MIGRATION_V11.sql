-- ============================================================
-- MIGRATION V11 — Erweiterte Bets-Spalten (optional, für zukünftige Features)
-- ============================================================
-- Diese Spalten werden benötigt, wenn erweiterte Deal-Modi aktiviert werden.
-- Aktuell funktioniert die Deal-Erstellung auch ohne diese Spalten.
-- ============================================================

-- Sichtbarkeit: public / private / friends
ALTER TABLE bets ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

-- Modus: 1v1, open_challenge, team, group
ALTER TABLE bets ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT '1v1';

-- Beitritts-Modus: open, invite, approval
ALTER TABLE bets ADD COLUMN IF NOT EXISTS join_mode TEXT DEFAULT 'open';

-- Max Teilnehmer (für Gruppen-Deals)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS max_participants INT DEFAULT 2;

-- Regelwerk-Typ: simple, best_of_3, tournament
ALTER TABLE bets ADD COLUMN IF NOT EXISTS ruleset_type TEXT DEFAULT 'simple';

-- Punkte-Modus: winner_takes_all, split, points
ALTER TABLE bets ADD COLUMN IF NOT EXISTS scoring_mode TEXT DEFAULT 'winner_takes_all';

-- Template-Referenz (falls Deal von Vorlage erstellt)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS template_id UUID;

-- Parent-Deal (für Rematches)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS parent_deal_id UUID;

-- ============================================================
-- Tabellen für Team-Modus (zukünftig)
-- ============================================================

CREATE TABLE IF NOT EXISTS deal_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES bets(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  team_color TEXT DEFAULT '#FFB800',
  team_side TEXT CHECK (team_side IN ('a', 'b')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deal_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES bets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  team_id UUID REFERENCES deal_teams(id),
  role TEXT DEFAULT 'participant',
  joined_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE deal_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_teams_read" ON deal_teams FOR SELECT USING (true);
CREATE POLICY "deal_teams_insert" ON deal_teams FOR INSERT WITH CHECK (true);

CREATE POLICY "deal_participants_read" ON deal_participants FOR SELECT USING (true);
CREATE POLICY "deal_participants_insert" ON deal_participants FOR INSERT WITH CHECK (true);
