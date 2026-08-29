-- ════════════════════════════════════════════════════════════════
-- WEB PUSH SUBSCRIPTIONS — run AFTER 001..010
--
-- Stores the browser Push subscriptions of visitors who opted in to
-- device notifications, so the admin broadcast can reach them even when
-- the app (PWA) is closed. Each row is one browser/device endpoint.
--
-- track/plan mirror the student's saved profile so a broadcast can be
-- targeted the same way notifications are (all / track / plan). They are
-- optional — a guest can still subscribe (track/plan NULL → only 'all').
--
-- Written and read exclusively by the server (service_role) — never from
-- the browser — so no public RLS policy is granted. RLS is enabled with
-- no policy, which denies anon/authenticated by default while the
-- service_role key bypasses RLS.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  track       TEXT,
  plan        TEXT,
  student_name TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_track_idx ON push_subscriptions (track);
CREATE INDEX IF NOT EXISTS push_subscriptions_plan_idx  ON push_subscriptions (plan);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- No policy: only the service_role (server) may read/write these rows.
