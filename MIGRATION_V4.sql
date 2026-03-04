-- ============================================================
-- DealBuddy MIGRATION V4 – Social / Chat System
-- Run in Supabase SQL Editor AFTER V2 and V3
-- ============================================================

-- ─── 1. conversations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_1        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at      TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT,
  unread_1             INT  DEFAULT 0, -- unread count for participant_1
  unread_2             INT  DEFAULT 0, -- unread count for participant_2
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2),
  CONSTRAINT no_self_conversation CHECK (participant_1 <> participant_2)
);

-- ─── 2. messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content         TEXT NOT NULL CHECK (char_length(content) <= 2000),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. blocked_users ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_users (
  blocker_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

-- ─── 4. notifications (ensure exists + right shape) ──────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,   -- follow_request | follow_accepted | new_message | deal_request | deal_update | level_up
  title        TEXT NOT NULL,
  body         TEXT,
  reference_id TEXT,            -- e.g. conversation_id, deal_id, user_id
  read         BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. profiles: ensure social columns exist ────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private     BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS follower_count  INT     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INT     DEFAULT 0;

-- ─── 6. indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_convo       ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender      ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread      ON messages(conversation_id, sender_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_convos_p1            ON conversations(participant_1, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_convos_p2            ON conversations(participant_2, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifs_user_unread   ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocked_blocker      ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_follows_following    ON follows(following_id, status);

-- ─── 7. RLS – conversations ───────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants can select"    ON conversations;
DROP POLICY IF EXISTS "participants can insert"    ON conversations;
DROP POLICY IF EXISTS "participants can update"    ON conversations;

CREATE POLICY "participants can select"
  ON conversations FOR SELECT
  USING (participant_1 = auth.uid() OR participant_2 = auth.uid());

CREATE POLICY "participants can insert"
  ON conversations FOR INSERT
  WITH CHECK (participant_1 = auth.uid() OR participant_2 = auth.uid());

CREATE POLICY "participants can update"
  ON conversations FOR UPDATE
  USING (participant_1 = auth.uid() OR participant_2 = auth.uid());

-- ─── 8. RLS – messages ───────────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants can read messages"   ON messages;
DROP POLICY IF EXISTS "participants can send messages"   ON messages;
DROP POLICY IF EXISTS "recipients can mark read"         ON messages;

CREATE POLICY "participants can read messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE POLICY "participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE POLICY "recipients can mark read"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

-- ─── 9. RLS – blocked_users ──────────────────────────────────────────────────
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blockers manage their blocks" ON blocked_users;
DROP POLICY IF EXISTS "users see their own blocks"   ON blocked_users;

CREATE POLICY "users see their own blocks"
  ON blocked_users FOR SELECT
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

CREATE POLICY "blockers manage their blocks"
  ON blocked_users FOR ALL
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());

-- ─── 10. RLS – notifications ─────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own notifs"   ON notifications;
DROP POLICY IF EXISTS "users update own notifs" ON notifications;
DROP POLICY IF EXISTS "anyone insert notifs"    ON notifications;

CREATE POLICY "users read own notifs"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users update own notifs"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "anyone insert notifs"
  ON notifications FOR INSERT
  WITH CHECK (TRUE);

-- ─── 11. RLS – follows (ensure exists) ───────────────────────────────────────
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own follows" ON follows;
DROP POLICY IF EXISTS "users see all follows"    ON follows;

CREATE POLICY "users see all follows"
  ON follows FOR SELECT
  USING (TRUE);

CREATE POLICY "users manage own follows"
  ON follows FOR ALL
  USING (follower_id = auth.uid())
  WITH CHECK (follower_id = auth.uid());

-- ─── 12. follower_count trigger ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'accepted' THEN
    UPDATE profiles SET follower_count  = follower_count  + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    UPDATE profiles SET follower_count  = follower_count  + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'accepted' THEN
    UPDATE profiles SET follower_count  = GREATEST(0, follower_count  - 1) WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_follower_counts ON follows;
CREATE TRIGGER trg_follower_counts
  AFTER INSERT OR UPDATE OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follower_counts();

-- ─── 13. backfill follower/following counts for existing follows ──────────────
UPDATE profiles p SET
  follower_count = (
    SELECT COUNT(*) FROM follows f WHERE f.following_id = p.id AND f.status = 'accepted'
  ),
  following_count = (
    SELECT COUNT(*) FROM follows f WHERE f.follower_id = p.id AND f.status = 'accepted'
  );

-- ─── 14. Realtime – enable for messages ──────────────────────────────────────
ALTER TABLE messages      REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- ─── 15. increment_unread RPC (used by chat to bump unread counter) ───────────
CREATE OR REPLACE FUNCTION increment_unread(convo_id UUID, col_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF col_name = 'unread_1' THEN
    UPDATE conversations SET unread_1 = unread_1 + 1 WHERE id = convo_id;
  ELSIF col_name = 'unread_2' THEN
    UPDATE conversations SET unread_2 = unread_2 + 1 WHERE id = convo_id;
  END IF;
END;
$$;
