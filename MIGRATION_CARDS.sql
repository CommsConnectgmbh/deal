-- ============================================================
-- MIGRATION: Card Creator — Prompts + DNA Options
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Card Prompts table
CREATE TABLE IF NOT EXISTS card_prompts (
  id SERIAL PRIMARY KEY,
  prompt_key TEXT UNIQUE NOT NULL,
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('master', 'base', 'archetype_block', 'custom')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Card DNA Options table
CREATE TABLE IF NOT EXISTS card_dna_options (
  id SERIAL PRIMARY KEY,
  field TEXT NOT NULL CHECK (field IN ('gender', 'age', 'origin', 'hair')),
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  UNIQUE(field, value)
);

-- 3. RLS policies (public read, service_role write)
ALTER TABLE card_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_dna_options ENABLE ROW LEVEL SECURITY;

-- Allow public read for both tables (card.html loads via anon key)
CREATE POLICY "card_prompts_public_read" ON card_prompts
  FOR SELECT USING (true);

CREATE POLICY "card_dna_options_public_read" ON card_dna_options
  FOR SELECT USING (true);

-- Allow service_role full access (edge functions use service_role)
CREATE POLICY "card_prompts_service_write" ON card_prompts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "card_dna_options_service_write" ON card_dna_options
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Seed: Master Prompt
INSERT INTO card_prompts (prompt_key, prompt_type, content) VALUES
('master', 'master', 'Transform the base avatar into a powerful character archetype for the DealBuddy trading card universe.

IMPORTANT: Keep the exact same face and identity of the character.

Apply a strong archetype transformation that changes:
• clothing
• posture
• lighting
• atmosphere
• energy aura

The archetype must visually dominate the character.

Style: AAA video game character render, dramatic cinematic lighting, high contrast, ultra detailed, epic hero portrait.

No card frame. Only the character portrait.')
ON CONFLICT (prompt_key) DO NOTHING;

-- 5. Seed: Base Prompt
INSERT INTO card_prompts (prompt_key, prompt_type, content) VALUES
('base_prompt', 'base', 'Create a highly detailed stylized avatar portrait for a premium digital trading card universe.
The image must show ONLY the base avatar character.
No card frame. No text. No UI elements. No special effects.

COMPOSITION:
Head and upper body portrait (head, neck, shoulders, upper chest).
Character centered and filling approximately 60-70% of the image height.
Single character only. Face looking slightly off-center.

RENDER STYLE:
High-end 3D character render similar to FIFA Ultimate Team or premium mobile game cards.
Semi-realistic with natural human proportions.
NOT anime, NOT cartoon, NOT doll-like, NOT puppet-like.
Natural facial proportions with realistic eyes, skin texture, and cinematic lighting.
AAA game quality character render, ultra sharp, 8k detail.

BACKGROUND:
Dark atmospheric background that fades to near-black at all edges.
The outer 15% of the image must be very dark (near-black).

STRICT RULES:
Single portrait only. No split layout. No collage. No UI panels.
No additional characters. No text. No frame. No border.
No fantasy elements. No cyberpunk. No energy effects. Only the base avatar.')
ON CONFLICT (prompt_key) DO NOTHING;

-- 6. Seed: Archetype Blocks
INSERT INTO card_prompts (prompt_key, prompt_type, content) VALUES
('block_founder', 'archetype_block', 'Archetype: Founder
Appearance: luxury tailored black suit with subtle gold accents, minimalist tech billionaire style.
Pose: confident upright posture, calm leader presence.
Energy: bright golden aura radiating behind the character.
Lighting: dramatic warm golden rim light.
Mood: visionary tech founder, empire builder, charismatic leader.'),

('block_trader', 'archetype_block', 'Archetype: Trader
Appearance: luxury business suit, gold watch and chain.
Pose: arms crossed or confident relaxed stance.
Energy: floating golden particles and subtle currency symbols.
Lighting: sharp cinematic lighting with warm highlights.
Mood: elite market strategist, confident and calculating.'),

('block_hacker', 'archetype_block', 'Archetype: Hacker
Appearance: futuristic cyberpunk jacket, tech details and digital accessories.
Pose: focused slightly forward posture.
Energy: neon blue and purple digital aura.
Lighting: strong cyberpunk neon lighting.
Mood: mysterious digital mastermind.'),

('block_visionary', 'archetype_block', 'Archetype: Visionary
Appearance: stylish futuristic clothing.
Pose: calm thoughtful posture.
Energy: cosmic stardust aura around the character.
Lighting: soft glowing cosmic light.
Mood: innovator, dreamer of the future.'),

('block_strategist', 'archetype_block', 'Archetype: Strategist
Appearance: minimal elegant clothing, clean intellectual style.
Pose: thoughtful confident stance.
Energy: subtle intelligent glow.
Lighting: cool cinematic lighting with calm shadows.
Mood: brilliant mastermind and master planner.'),

('block_hustler', 'archetype_block', 'Archetype: Hustler
Appearance: streetwear hoodie, urban fashion style.
Pose: relaxed confident street stance.
Energy: warm energetic glow.
Lighting: urban dramatic lighting with deep shadows.
Mood: self made entrepreneur, ambitious and fearless.'),

('block_maverick', 'archetype_block', 'Archetype: Maverick
Appearance: rebellious stylish outfit, modern luxury street style.
Pose: bold confident stance.
Energy: dynamic glowing energy.
Lighting: dramatic high contrast lighting.
Mood: independent rule breaker.'),

('block_titan', 'archetype_block', 'Archetype: Titan
Appearance: powerful older leader, luxurious dark coat or armor like clothing.
Pose: dominant upright stance.
Energy: dark powerful aura surrounding the character.
Lighting: heavy cinematic shadows and strong rim light.
Mood: ancient mastermind and legendary power figure.'),

('block_dragon', 'archetype_block', 'Archetype: Dragon
Appearance: humanoid infused with ancient dragon power, subtle dragon scales, glowing dragon eyes, small horns.
Pose: powerful mythic stance.
Energy: ancient dragon magic aura swirling around the character.
Lighting: epic fantasy lighting with powerful rim light.
Mood: legendary mythical being.')
ON CONFLICT (prompt_key) DO NOTHING;

-- 7. Seed: DNA Options
INSERT INTO card_dna_options (field, value, label, sort_order) VALUES
('gender', 'male', 'Male', 1),
('gender', 'female', 'Female', 2),
('age', 'young', 'Young (18-30)', 1),
('age', 'prime', 'Prime (30-60)', 2),
('age', 'elite', 'Elite (60-100)', 3),
('origin', 'european', 'European', 1),
('origin', 'african', 'African', 2),
('origin', 'asian', 'Asian', 3),
('hair', 'short hair', 'Short Hair', 1),
('hair', 'long hair', 'Long Hair', 2),
('hair', 'curly hair', 'Curly Hair', 3)
ON CONFLICT (field, value) DO NOTHING;

-- Done!
SELECT 'Migration complete' AS status,
  (SELECT count(*) FROM card_prompts) AS prompts_count,
  (SELECT count(*) FROM card_dna_options) AS dna_options_count;
