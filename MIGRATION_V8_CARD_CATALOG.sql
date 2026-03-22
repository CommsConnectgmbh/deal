-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V8: Card Catalog System
-- Neues Kartensystem mit vorab generierten Karten,
-- Zuordnung per Attribut-Matching, und Sammlungs-Evolution.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- 1. KARTEN-KATALOG (vorab generierte Karten)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS card_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Frame & Rarity
  frame TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common','rare','epic','legendary','founder','event')),

  -- Attribute
  gender TEXT NOT NULL CHECK (gender IN ('male','female')),
  origin TEXT NOT NULL CHECK (origin IN ('european','african','east_asian','south_asian','latin','middle_eastern')),
  hair TEXT NOT NULL CHECK (hair IN ('short','long','curly','buzz','ponytail','braided')),
  style TEXT NOT NULL CHECK (style IN ('business_suit','luxury_blazer','streetwear_hoodie','tech_founder','cyberpunk_jacket','fantasy_armor')),
  accessory TEXT NOT NULL CHECK (accessory IN ('none','glasses','gold_chain','watch','earrings')),
  effect TEXT NOT NULL CHECK (effect IN ('none','glow','particles','lightning','fire','ice','rainbow','holographic')),

  -- Eindeutiger Code
  card_code TEXT NOT NULL UNIQUE,

  -- Laufende Nummer innerhalb des Frames
  serial_number INTEGER NOT NULL,
  serial_display TEXT, -- z.B. '#023 / 050' für Founder

  -- Bild
  image_url TEXT, -- DALL-E generiertes komplettes Bild

  -- Status
  is_claimed BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,

  -- Metadata
  season TEXT DEFAULT 'season_1',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_code ON card_catalog(card_code);
CREATE INDEX IF NOT EXISTS idx_card_unclaimed ON card_catalog(frame, is_claimed, is_available)
  WHERE is_claimed = false AND is_available = true;
CREATE INDEX IF NOT EXISTS idx_card_attributes ON card_catalog(gender, origin, hair, style, accessory);

-- ═══════════════════════════════════════
-- 2. USER KARTEN (Sammlung)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES card_catalog(id),
  is_equipped BOOLEAN DEFAULT false,
  obtained_from TEXT CHECK (obtained_from IN (
    'registration','upgrade','shop','battle_pass','event','pack','achievement'
  )),
  obtained_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_cards_user ON user_cards(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_equipped ON user_cards(user_id) WHERE is_equipped = true;

-- ═══════════════════════════════════════
-- 3. USER AVATAR DNA (fixe Basis-Attribute)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_avatar_dna (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  gender TEXT NOT NULL,
  origin TEXT NOT NULL,
  hair TEXT NOT NULL,
  style TEXT NOT NULL,
  current_accessory TEXT NOT NULL DEFAULT 'none',
  current_effect TEXT NOT NULL DEFAULT 'none',
  current_frame TEXT NOT NULL DEFAULT 'bronze',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- 4. FREIGESCHALTETE ITEMS PRO USER
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_unlocked_items (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('accessory','effect','frame')),
  item_code TEXT NOT NULL,
  unlocked_via TEXT CHECK (unlocked_via IN ('free','coins','battle_pass','shop','event','achievement')),
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, item_type, item_code)
);

-- ═══════════════════════════════════════
-- 5. RLS POLICIES
-- ═══════════════════════════════════════
ALTER TABLE card_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_avatar_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_unlocked_items ENABLE ROW LEVEL SECURITY;

-- card_catalog: Jeder kann lesen, nur service_role schreibt
DROP POLICY IF EXISTS "card_catalog_read" ON card_catalog;
CREATE POLICY "card_catalog_read" ON card_catalog FOR SELECT USING (true);

-- user_cards: User sieht eigene + equipped von anderen
DROP POLICY IF EXISTS "user_cards_own" ON user_cards;
CREATE POLICY "user_cards_own" ON user_cards FOR SELECT
  USING (user_id = auth.uid() OR is_equipped = true);

DROP POLICY IF EXISTS "user_cards_insert" ON user_cards;
CREATE POLICY "user_cards_insert" ON user_cards FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_cards_update" ON user_cards;
CREATE POLICY "user_cards_update" ON user_cards FOR UPDATE
  USING (user_id = auth.uid());

-- user_avatar_dna: User sieht eigene + alle (für Profil-Anzeige)
DROP POLICY IF EXISTS "avatar_dna_read" ON user_avatar_dna;
CREATE POLICY "avatar_dna_read" ON user_avatar_dna FOR SELECT USING (true);

DROP POLICY IF EXISTS "avatar_dna_insert" ON user_avatar_dna;
CREATE POLICY "avatar_dna_insert" ON user_avatar_dna FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "avatar_dna_update" ON user_avatar_dna;
CREATE POLICY "avatar_dna_update" ON user_avatar_dna FOR UPDATE
  USING (user_id = auth.uid());

-- user_unlocked_items: User sieht nur eigene
DROP POLICY IF EXISTS "unlocked_items_own" ON user_unlocked_items;
CREATE POLICY "unlocked_items_own" ON user_unlocked_items FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "unlocked_items_insert" ON user_unlocked_items;
CREATE POLICY "unlocked_items_insert" ON user_unlocked_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════
