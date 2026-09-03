-- Server-scheduled push reminders.
--
-- Lecture and task reminders used to fire only from an open tab (a client-side
-- setInterval + new Notification()). This adds the server half so a reminder
-- arrives even when the site is closed: the browser computes each reminder's
-- absolute instant and mirrors the upcoming list here, and a per-minute
-- scheduler (pg_cron → the /api/cron/reminders endpoint) sends whatever is due.

-- 1) Tie a stored push subscription to the student who owns it, so the
--    scheduler can reach exactly that student's devices. Nullable: older rows
--    and browse-mode devices simply carry no code.
alter table if exists public.push_subscriptions
  add column if not exists code text;

create index if not exists push_subscriptions_code_idx
  on public.push_subscriptions (code);

-- 2) The queue of upcoming reminders. One row per (student, thing, occurrence).
create table if not exists public.push_reminders (
  id         bigint generated always as identity primary key,
  code       text        not null,
  dedup_key  text        not null,
  title      text,
  body       text,
  url        text        not null default '/',
  fire_at    timestamptz not null,
  sent_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (code, dedup_key)
);

-- The scheduler's hot path: "unsent rows whose time has come".
create index if not exists push_reminders_due_idx
  on public.push_reminders (fire_at)
  where sent_at is null;

create index if not exists push_reminders_code_idx
  on public.push_reminders (code);

-- Deny-all like every other table: reached only through the service role.
alter table public.push_reminders enable row level security;
