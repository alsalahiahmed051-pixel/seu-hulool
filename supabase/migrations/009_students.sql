-- ════════════════════════════════════════════════════════════════
-- LIGHTWEIGHT STUDENT SIGN-UP — run AFTER 001..008
--
-- A no-email registration for students: full name + track + plan +
-- a hashed password. Rows are written ONLY by the server (service_role)
-- through /api/student/register; there is no public read/write. The admin
-- panel lists them via a service_role API. This is an MVP convenience
-- record, not a security-grade auth system (no email = no recovery).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  track TEXT,
  plan TEXT,
  pass_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS students_full_name_idx ON students (lower(full_name));

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: the table is reachable only through the
-- service_role (server APIs). Deny-by-default for everyone else.
GRANT ALL ON students TO service_role;
