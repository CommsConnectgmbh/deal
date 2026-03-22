-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V19 — Profile Status, Deal Side, Bookmarks, Chat Realtime Fix
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. Profile Status Text ═══
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_text TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NULL;

-- ═══ 2. Deal Creator Side (Ja/Nein, Ich glaube dran) ═══
ALTER TABLE bets ADD COLUMN IF NOT EXISTS creator_side TEXT DEFAULT NULL;
-- Values: 'yes' / 'no' / null (no side chosen)

-- ═══ 3. Bookmarks (for deals AND tip groups) ═══
CREATE TABLE IF NOT EXISTS user_bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('deal', 'tip_group')),
  item_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_unique ON user_bookmarks(user_id, item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON user_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_item ON user_bookmarks(item_type, item_id);

ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookmarks_select" ON user_bookmarks;
CREATE POLICY "bookmarks_select" ON user_bookmarks FOR SELECT USING (true);

DROP POLICY IF EXISTS "bookmarks_insert" ON user_bookmarks;
CREATE POLICY "bookmarks_insert" ON user_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bookmarks_delete" ON user_bookmarks;
CREATE POLICY "bookmarks_delete" ON user_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- ═══ 4. Chat: ensure message columns exist ═══
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_preview TEXT;

-- ═══ 5. Chat: typing indicators table ═══
CREATE TABLE IF NOT EXISTS typing_indicators (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, conversation_id)
);

ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "typing_select" ON typing_indicators;
CREATE POLICY "typing_select" ON typing_indicators FOR SELECT USING (true);

DROP POLICY IF EXISTS "typing_insert" ON typing_indicators;
CREATE POLICY "typing_insert" ON typing_indicators FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "typing_delete" ON typing_indicators;
CREATE POLICY "typing_delete" ON typing_indicators FOR DELETE USING (auth.uid() = user_id);

-- ═══ 6. Enable Realtime on critical tables ═══
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE typing_indicators REPLICA IDENTITY FULL;
ALTER TABLE user_presence REPLICA IDENTITY FULL;

-- ═══ 7. Tip group social tables (referenced in code but missing) ═══
CREATE TABLE IF NOT EXISTS tip_group_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tgl_unique ON tip_group_likes(group_id, user_id);
ALTER TABLE tip_group_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tgl_select" ON tip_group_likes;
CREATE POLICY "tgl_select" ON tip_group_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "tgl_insert" ON tip_group_likes;
CREATE POLICY "tgl_insert" ON tip_group_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "tgl_delete" ON tip_group_likes;
CREATE POLICY "tgl_delete" ON tip_group_likes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS tip_group_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tip_group_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tgc_select" ON tip_group_comments;
CREATE POLICY "tgc_select" ON tip_group_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "tgc_insert" ON tip_group_comments;
CREATE POLICY "tgc_insert" ON tip_group_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS tip_group_reposts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tgr_unique ON tip_group_reposts(group_id, user_id);
ALTER TABLE tip_group_reposts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tgr_select" ON tip_group_reposts;
CREATE POLICY "tgr_select" ON tip_group_reposts FOR SELECT USING (true);
DROP POLICY IF EXISTS "tgr_insert" ON tip_group_reposts;
CREATE POLICY "tgr_insert" ON tip_group_reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "tgr_delete" ON tip_group_reposts;
CREATE POLICY "tgr_delete" ON tip_group_reposts FOR DELETE USING (auth.uid() = user_id);
