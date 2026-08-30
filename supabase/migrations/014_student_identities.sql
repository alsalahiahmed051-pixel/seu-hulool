-- ════════════════════════════════════════════════════════════════
-- STUDENT IDENTITIES — run AFTER 001..013
--
-- Who is using the site, recorded server-side.
--
-- Until now a student's name, university ID, email and track lived only in
-- their browser's localStorage. That made the 15-day track lock advisory:
-- clear the site data and you had a brand-new profile. This table is the
-- authoritative copy, keyed on the id from the signed httpOnly cookie the
-- server issues — which page scripts cannot read or edit — so the record
-- survives a cleared browser and the lock actually holds.
--
-- Not authentication: there is no password and no verified email. It answers
-- "which device is this, and what did it tell us", which is what the track
-- lock and the assistant's allowance need.
--
-- Written by the server (service_role) and read only by admins, so RLS is
-- enabled with no public policy.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS student_identities (
  device_id     TEXT PRIMARY KEY,
  full_name     TEXT,
  student_id    TEXT,
  email         TEXT,
  track         TEXT,
  college       TEXT,
  plan          TEXT,
  confirmed_at  TIMESTAMPTZ,          -- when the track was confirmed (lock start)
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The admin panel lists these newest-first and searches by name or ID.
CREATE INDEX IF NOT EXISTS student_identities_last_seen_idx ON student_identities (last_seen DESC);
CREATE INDEX IF NOT EXISTS student_identities_student_id_idx ON student_identities (student_id);
CREATE INDEX IF NOT EXISTS student_identities_email_idx ON student_identities (lower(email));

ALTER TABLE student_identities ENABLE ROW LEVEL SECURITY;
-- No policy: only the service_role (server) may read/write these rows.
