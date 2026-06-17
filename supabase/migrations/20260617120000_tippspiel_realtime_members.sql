-- Realtime: tip_group_members + tip_questions in supabase_realtime publication aufnehmen,
-- damit Cron-Scoring-Updates in offenen Leaderboard-Views live ankommen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tip_group_members'
  ) then
    execute 'alter publication supabase_realtime add table public.tip_group_members';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tip_questions'
  ) then
    execute 'alter publication supabase_realtime add table public.tip_questions';
  end if;
end$$;
