-- Performance cleanup. Applied to remote 2026-06-01 via MCP; mirrored here for repo truth.

-- (1) Drop redundant duplicate indexes. Each dropped index is fully covered by a
-- remaining unique constraint / primary key / identical plain index on the same columns.
-- NOTE: deal_metric_samples_latest_idx is intentionally KEPT — it sorts sampled_at DESC
-- for "latest sample" lookups and is NOT a duplicate of the ASC unique dedup index.
DROP INDEX IF EXISTS public.idx_cf_bet_id;            -- covered by unique challenge_fulfillment_bet_id_key (challenge_id)
DROP INDEX IF EXISTS public.idx_deal_likes_user_id;   -- identical to idx_deal_likes_user (user_id)
DROP INDEX IF EXISTS public.idx_deal_reposts_deal;    -- identical to idx_deal_reposts_original (original_deal_id)
DROP INDEX IF EXISTS public.idx_tgl_unique;           -- covered by PK tip_group_likes_pkey (group_id, user_id)
DROP INDEX IF EXISTS public.idx_tgr_unique;           -- covered by unique tip_group_reposts_group_id_user_id_key (group_id, user_id)

-- (2) Drop redundant permissive RLS policies that have an IDENTICAL twin (same table,
-- cmd, roles, qual, with_check) with an earlier-sorting name. Only removes a policy when
-- a functionally identical one remains, so access semantics are unchanged.
DO $$
DECLARE r record;
BEGIN
  CREATE TEMP TABLE _dup_policies ON COMMIT DROP AS
  SELECT p.tablename, p.policyname
  FROM pg_policies p
  WHERE p.schemaname='public' AND p.permissive='PERMISSIVE'
    AND EXISTS (
      SELECT 1 FROM pg_policies q
      WHERE q.schemaname='public' AND q.permissive='PERMISSIVE'
        AND q.tablename = p.tablename
        AND q.cmd = p.cmd
        AND array_to_string(q.roles, ',') = array_to_string(p.roles, ',')
        AND coalesce(q.qual, '∅') = coalesce(p.qual, '∅')
        AND coalesce(q.with_check, '∅') = coalesce(p.with_check, '∅')
        AND q.policyname < p.policyname
    );

  FOR r IN SELECT * FROM _dup_policies LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;
