-- Resolve multiple_permissive_policies overlaps WITHOUT changing access semantics.
-- "FOR ALL" owner policies overlapped a dedicated "FOR SELECT" policy on SELECT; the
-- SELECT policy is a proven superset, so split ALL into INSERT/UPDATE/DELETE (identical
-- conditions) and let SELECT be served by the dedicated policy. Access unchanged.
-- Applied to remote 2026-06-02 via MCP; mirrored here for repo truth.

DROP POLICY IF EXISTS "blockers manage their blocks" ON public.blocked_users;
CREATE POLICY blocked_users_owner_insert ON public.blocked_users AS PERMISSIVE FOR INSERT TO public WITH CHECK (blocker_id = (select auth.uid()));
CREATE POLICY blocked_users_owner_update ON public.blocked_users AS PERMISSIVE FOR UPDATE TO public USING (blocker_id = (select auth.uid())) WITH CHECK (blocker_id = (select auth.uid()));
CREATE POLICY blocked_users_owner_delete ON public.blocked_users AS PERMISSIVE FOR DELETE TO public USING (blocker_id = (select auth.uid()));

DROP POLICY IF EXISTS bookmark_manage ON public.deal_bookmarks;
CREATE POLICY deal_bookmarks_owner_insert ON public.deal_bookmarks AS PERMISSIVE FOR INSERT TO public WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY deal_bookmarks_owner_update ON public.deal_bookmarks AS PERMISSIVE FOR UPDATE TO public USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY deal_bookmarks_owner_delete ON public.deal_bookmarks AS PERMISSIVE FOR DELETE TO public USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Eigene side challenges" ON public.deal_side_challenges;
CREATE POLICY deal_side_challenges_owner_insert ON public.deal_side_challenges AS PERMISSIVE FOR INSERT TO public WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY deal_side_challenges_owner_update ON public.deal_side_challenges AS PERMISSIVE FOR UPDATE TO public USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY deal_side_challenges_owner_delete ON public.deal_side_challenges AS PERMISSIVE FOR DELETE TO public USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Inventory owner write" ON public.inventory;
CREATE POLICY inventory_owner_insert ON public.inventory AS PERMISSIVE FOR INSERT TO public WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY inventory_owner_update ON public.inventory AS PERMISSIVE FOR UPDATE TO public USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY inventory_owner_delete ON public.inventory AS PERMISSIVE FOR DELETE TO public USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own rivalries" ON public.rivalries;
CREATE POLICY rivalries_owner_insert ON public.rivalries AS PERMISSIVE FOR INSERT TO public WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY rivalries_owner_update ON public.rivalries AS PERMISSIVE FOR UPDATE TO public USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY rivalries_owner_delete ON public.rivalries AS PERMISSIVE FOR DELETE TO public USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Notifications owner" ON public.notifications;
CREATE POLICY notifications_owner_select ON public.notifications AS PERMISSIVE FOR SELECT TO public USING ((select auth.uid()) = user_id);
CREATE POLICY notifications_owner_update ON public.notifications AS PERMISSIVE FOR UPDATE TO public USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY notifications_owner_delete ON public.notifications AS PERMISSIVE FOR DELETE TO public USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS typing_select_all ON public.typing_indicators;
DROP POLICY IF EXISTS typing_delete_own ON public.typing_indicators;
DROP POLICY IF EXISTS typing_upsert_own ON public.typing_indicators;
DROP POLICY IF EXISTS feed_events_select ON public.feed_events;
