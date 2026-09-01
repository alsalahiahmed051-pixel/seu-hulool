-- ════════════════════════════════════════════════════════════════
-- TRACK REQUESTS — let the student read the answer  (run AFTER 001..017)
--
-- track_requests already stores admin_reply, and the admin panel already
-- writes it. Nothing ever showed it to the student, because there was no way
-- to find their own row: the table records a name and a university number,
-- neither of which identifies the caller.
--
-- device_id is the id from the signed httpOnly cookie, like every other
-- per-device record here, so "my request" is answerable without an account
-- and cannot be spoofed by editing localStorage.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE track_requests
  ADD COLUMN IF NOT EXISTS device_id TEXT;

CREATE INDEX IF NOT EXISTS track_requests_device_idx
  ON track_requests (device_id, created_at DESC);
