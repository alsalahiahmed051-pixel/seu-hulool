-- ════════════════════════════════════════════════════════════════
-- AI SUBSCRIPTION REQUESTS — run AFTER 001..012
--
-- The assistant gives every visitor a few free questions per hour. A student
-- who wants more sends a request here with their transfer receipt; an admin
-- checks it and approves, which sets expires_at and lifts the limit for that
-- device until then.
--
-- device_id is the id from the signed httpOnly cookie the server issues, so
-- the subscription follows the device rather than an account (the site has
-- none) and a student cannot grant one to themselves.
--
-- Written by the server (service_role) and read only by admins, so RLS is
-- enabled with no public policy: anon/authenticated are denied by default
-- while the service_role key bypasses RLS.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_subscriptions (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id     TEXT NOT NULL,
  student_name  TEXT,
  student_id    TEXT,
  email         TEXT,
  note          TEXT,                              -- what the student wrote
  receipt_url   TEXT,                              -- uploaded transfer receipt
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  admin_reply   TEXT,
  expires_at    TIMESTAMPTZ,                       -- set when approved
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The hot path is "is this device subscribed right now", so index for it.
CREATE INDEX IF NOT EXISTS ai_subscriptions_device_idx
  ON ai_subscriptions (device_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS ai_subscriptions_status_idx
  ON ai_subscriptions (status, created_at DESC);

ALTER TABLE ai_subscriptions ENABLE ROW LEVEL SECURITY;
-- No policy: only the service_role (server) may read/write these rows.
