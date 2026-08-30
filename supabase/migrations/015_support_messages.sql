-- ════════════════════════════════════════════════════════════════
-- SUPPORT MESSAGES — run AFTER 001..014
--
-- A student writing to the site owner: a question, a broken file, a request.
-- Until now the only route was the university's own phone number, which is
-- not who you contact about this site.
--
-- Written by the server (service_role) on the student's behalf and read only
-- by admins, so RLS is enabled with no public policy.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS support_messages (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id    TEXT,
  student_name TEXT,
  student_id   TEXT,
  email        TEXT,
  topic        TEXT,                              -- سؤال | مشكلة | اقتراح | ملف
  message      TEXT NOT NULL,
  page         TEXT,                              -- where they were when writing
  status       TEXT NOT NULL DEFAULT 'new',       -- new | read | answered
  admin_reply  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_status_idx ON support_messages (status, created_at DESC);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
-- No policy: only the service_role (server) may read/write these rows.
