-- ============================================================
-- Audit log retention — keep only last 180 days of state transitions.
--
-- Run manually in Supabase SQL Editor. After applying:
--   1. Verify pg_cron extension is enabled in Database → Extensions
--   2. The cron job runs daily at 04:00 UTC and prunes older rows
--
-- The audit table grows ~10–50 rows per active user per month. At MVP
-- scale this is tiny, but bounded retention keeps queries fast forever.
-- ============================================================

-- 1. Cleanup function — single TRUNCATE-style delete via WHERE
create or replace function prune_old_state_transitions()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from public.user_state_transitions
  where created_at < now() - interval '180 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- 2. Schedule via pg_cron (extension may need enabling in Supabase dashboard)
-- Removes any prior schedule for safety, then installs fresh.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('prune-state-transitions')
      where exists (select 1 from cron.job where jobname = 'prune-state-transitions');
    perform cron.schedule(
      'prune-state-transitions',
      '0 4 * * *',
      $cron$ select prune_old_state_transitions(); $cron$
    );
  else
    raise notice 'pg_cron extension not enabled — call prune_old_state_transitions() manually or enable pg_cron in dashboard.';
  end if;
end
$$;

-- 3. Index on created_at for efficient pruning + audit page queries
create index if not exists idx_state_transitions_created
  on user_state_transitions(created_at);
