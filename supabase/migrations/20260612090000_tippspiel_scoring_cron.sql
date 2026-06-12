-- Autonomous Tippspiel scoring via pg_cron.
--
-- The scoring pipeline (sync-league-matches → resolve-matchday → score-bracket)
-- used to fire only client-side when an admin opened the group. This wires it to
-- a server-side schedule so points land without anyone opening the app.
--
-- Architecture:
--   * cron-score-groups (edge fn) orchestrates the pipeline per active group and
--     reuses the exact same edge functions the client triggers (no logic drift).
--     It is invoked with an `x-cron-secret` header validated against app_secrets.
--   * The sub-functions accept a trusted internal call when the Authorization
--     bearer equals the service-role key (skips the per-user admin check).
--   * pg_cron + pg_net post to the orchestrator every 15 minutes.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Shared-secret store. RLS-locked: only postgres / service_role (RLS bypass) can
-- read it — anon/authenticated get nothing. Holds the cron orchestrator secret.
create table if not exists public.app_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

insert into public.app_secrets (key, value)
values ('cron_secret', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- Run the scorer every 15 minutes. The orchestrator itself decides which groups
-- are relevant (live / recently kicked off / finished-but-unscored), so off-season
-- runs are cheap no-ops.
select cron.unschedule('tippspiel-score')
where exists (select 1 from cron.job where jobname = 'tippspiel-score');

select cron.schedule(
  'tippspiel-score',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://vjygmfaefhkwznldegvq.supabase.co/functions/v1/cron-score-groups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_secrets where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $job$
);
