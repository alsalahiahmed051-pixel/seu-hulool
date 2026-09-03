-- One-time activation of the reminder scheduler. NOT auto-applied.
--
-- Run this by hand ONLY after both are true:
--   1. CRON_SECRET is set in the app's environment (Vercel) and deployed.
--   2. The same secret is stored in Supabase Vault as `cron_secret` (below).
--
-- Until then the /api/cron/reminders endpoint fails closed (401), so there is
-- nothing to schedule against.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the shared bearer secret once. Replace <PASTE_CRON_SECRET> with the
-- exact value put in the app environment, then run just this statement:
--   select vault.create_secret('<PASTE_CRON_SECRET>', 'cron_secret',
--                              'Bearer token for /api/cron/reminders');

-- Fire the scheduler every minute. pg_net POSTs to the app, which sends every
-- due reminder. Deliberately not Vercel Cron (Hobby fires at most once a day).
select cron.schedule(
  'push-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://seu-hulool.vercel.app/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'cron_secret' limit 1
      )
    )
  );
  $$
);

-- To stop it later:  select cron.unschedule('push-reminders');
-- To inspect:        select * from cron.job;  select * from cron.job_run_details order by start_time desc limit 20;
