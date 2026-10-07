-- Optional but recommended: run after schema.sql in Supabase SQL Editor.
-- The two UTC times cover Eastern daylight and standard time. One runs at
-- local midnight; the other is harmless. Reads also finalize overdue weeks.
create extension if not exists pg_cron;
select cron.schedule(
  'rotw-finalize-monday',
  '0 4,5 * * 1',
  $$select public.finalize_rotw_due();$$
);
