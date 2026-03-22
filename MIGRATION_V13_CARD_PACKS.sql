-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION V13 — Card Pack System (Fixed)                      ║
-- ║  DealBuddy PWA                                                  ║
-- ║  Drops & recreates: pack_definitions, pack_purchases,           ║
-- ║  card_pack_loot_table                                           ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── 0. CLEAN SLATE — Drop if exists (no production data) ────────

DROP TABLE IF EXISTS card_pack_loot_table CASCADE;
DROP TABLE IF EXISTS pack_purchases CASCADE;
DROP TABLE IF EXISTS pack_definitions CASCADE;

-- ─── 1. PACK DEFINITIONS ──────────────────────────────────────────

CREATE TABLE pack_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon_emoji TEXT NOT NULL DEFAULT '📦',
  pack_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (pack_type IN ('standard','premium','elite','event','founder')),
  price_coins INTEGER NOT NULL DEFAULT 0,
  cards_per_pack INTEGER NOT NULL DEFAULT 3,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. CARD PACK LOOT TABLE ─────────────────────────────────────
-- Defines the rarity weight distribution for each pack type

CREATE TABLE card_pack_loot_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES pack_definitions(id),
  rarity TEXT NOT NULL
    CHECK (rarity IN ('common','rare','epic','legendary','founder','event')),
  weight INTEGER NOT NULL DEFAULT 100,
  dust_if_unavailable INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. PACK PURCHASES ───────────────────────────────────────────

CREATE TABLE pack_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pack_id TEXT NOT NULL REFERENCES pack_definitions(id),
  cards_received JSONB DEFAULT '[]',
  coins_spent INTEGER DEFAULT 0,
  dust_earned INTEGER DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pack_purchases_user
  ON pack_purchases(user_id, purchased_at DESC);

-- ─── 4. RLS POLICIES ─────────────────────────────────────────────

ALTER TABLE pack_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pack_definitions_public_read" ON pack_definitions FOR SELECT USING (true);

ALTER TABLE card_pack_loot_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_pack_loot_public_read" ON card_pack_loot_table FOR SELECT USING (true);

ALTER TABLE pack_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pack_purchases_own_read" ON pack_purchases FOR SELECT USING (auth.uid() = user_id);

-- Service role policies (for edge functions)
CREATE POLICY "pack_purchases_service" ON pack_purchases FOR ALL USING (true) WITH CHECK (true);

-- ─── 5. SEED: PACK DEFINITIONS ───────────────────────────────────

INSERT INTO pack_definitions (id, name, description, icon_emoji, pack_type, price_coins, cards_per_pack, sort_order) VALUES
('starter_pack', 'Starter Pack',  '3 Karten — Perfekt fur den Einstieg!',           '🎁', 'standard', 500,  3, 1),
('premium_pack', 'Premium Pack',  '5 Karten — Hohere Chancen auf seltene Karten!',  '💎', 'premium',  1500, 5, 2),
('elite_pack',   'Elite Pack',    '5 Karten — Garantiert mindestens 1 Epic!',        '🔥', 'elite',    3500, 5, 3),
('event_pack',   'Event Pack',    '3 Karten — Exklusiv wahrend Events verfugbar!',   '🎪', 'event',    2000, 3, 4);

-- ─── 6. SEED: LOOT TABLES ────────────────────────────────────────

-- Starter Pack: 60% Common, 25% Rare, 12% Epic, 3% Legendary
INSERT INTO card_pack_loot_table (pack_id, rarity, weight, dust_if_unavailable) VALUES
('starter_pack', 'common',    60, 25),
('starter_pack', 'rare',      25, 50),
('starter_pack', 'epic',      12, 100),
('starter_pack', 'legendary',  3, 250);

-- Premium Pack: 35% Common, 35% Rare, 22% Epic, 8% Legendary
INSERT INTO card_pack_loot_table (pack_id, rarity, weight, dust_if_unavailable) VALUES
('premium_pack', 'common',    35, 25),
('premium_pack', 'rare',      35, 50),
('premium_pack', 'epic',      22, 100),
('premium_pack', 'legendary',  8, 250);

-- Elite Pack: 10% Common, 30% Rare, 40% Epic, 20% Legendary
INSERT INTO card_pack_loot_table (pack_id, rarity, weight, dust_if_unavailable) VALUES
('elite_pack', 'common',    10, 25),
('elite_pack', 'rare',      30, 50),
('elite_pack', 'epic',      40, 100),
('elite_pack', 'legendary', 20, 250);

-- Event Pack: 40% Common, 30% Rare, 20% Epic, 10% Event
INSERT INTO card_pack_loot_table (pack_id, rarity, weight, dust_if_unavailable) VALUES
('event_pack', 'common', 40, 25),
('event_pack', 'rare',   30, 50),
('event_pack', 'epic',   20, 100),
('event_pack', 'event',  10, 300);

-- ═══════════════════════════════════════════════════════════════════
-- DONE — V13 Card Pack System Migration Complete
-- Tabellen: pack_definitions, card_pack_loot_table, pack_purchases
-- ═══════════════════════════════════════════════════════════════════
