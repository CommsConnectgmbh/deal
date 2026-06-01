-- Performance: fix RLS auth_rls_initplan (189 findings). Bare auth.uid()/auth.role()/
-- auth.jwt()/auth.email() calls in policy USING/WITH CHECK were re-evaluated per row;
-- wrapping them in a scalar subquery makes Postgres evaluate them once per query.
-- Pure performance change — the logical result of each policy is identical.
-- Applied to remote 2026-06-01 via MCP apply_migration; this file mirrors it for repo truth.
DO $$
DECLARE r record; ddl text;
BEGIN
  CREATE TEMP TABLE _rls_fix ON COMMIT DROP AS
    SELECT tablename, policyname, permissive, cmd,
           array_to_string(roles, ', ') AS rolelist, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual IS NOT NULL AND qual ~* 'auth\.(uid|role|jwt|email)\(\)' AND qual !~* 'select auth\.')
        OR (with_check IS NOT NULL AND with_check ~* 'auth\.(uid|role|jwt|email)\(\)' AND with_check !~* 'select auth\.')
      );

  FOR r IN SELECT * FROM _rls_fix LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
    ddl := format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
                  r.policyname, r.tablename, r.permissive, r.cmd, r.rolelist);
    IF r.qual IS NOT NULL THEN
      ddl := ddl || ' USING (' ||
        regexp_replace(r.qual, 'auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'g') || ')';
    END IF;
    IF r.with_check IS NOT NULL THEN
      ddl := ddl || ' WITH CHECK (' ||
        regexp_replace(r.with_check, 'auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'g') || ')';
    END IF;
    EXECUTE ddl || ';';
  END LOOP;
END $$;
