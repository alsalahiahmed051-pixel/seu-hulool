-- ════════════════════════════════════════════════════════════════
-- TRACK CHANGE REQUESTS — run AFTER 001..011
--
-- A student's track is fixed for 15 days once confirmed. To change it sooner
-- they send a request with a reason, which lands here for an admin to read,
-- reply to, and approve or reject from the admin panel.
--
-- Written by the server (service_role) on the student's behalf and read only
-- by admins, so RLS is enabled with no public policy: anon/authenticated are
-- denied by default while the service_role key bypasses RLS.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS track_requests (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_name  TEXT NOT NULL,
  student_id    TEXT NOT NULL,
  current_track TEXT,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  admin_reply   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS track_requests_status_idx ON track_requests (status, created_at DESC);

ALTER TABLE track_requests ENABLE ROW LEVEL SECURITY;
-- No policy: only the service_role (server) may read/write these rows.
