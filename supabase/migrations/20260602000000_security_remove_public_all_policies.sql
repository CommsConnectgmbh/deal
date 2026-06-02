-- SECURITY: remove "FOR ALL USING(true) TO public" policies that let ANY visitor
-- (incl. anon) read/write/delete every row. Server code uses service_role (bypasses
-- RLS); the only client access is owner-scoped SELECT (kept). Verified: anon now gets
-- [] from both tables. Applied to remote 2026-06-02 via MCP; mirrored here for repo truth.
DROP POLICY IF EXISTS pack_purchases_service ON public.pack_purchases;        -- kept: pack_purchases_own_read
DROP POLICY IF EXISTS challenge_invites_service ON public.challenge_invites;  -- kept: challenge_invites_own_select
