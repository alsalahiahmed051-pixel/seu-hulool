-- ════════════════════════════════════════════════════════════════
-- AI MESSAGE ALLOWANCE — run AFTER 001..015
--
-- The free-question counter had no durable home. It lived in a Map inside the
-- serverless instance that happened to serve the request, and Vercel runs many
-- instances and recycles them constantly — so the first question counted, the
-- second landed on a different instance and counted as the first again, and
-- leaving the page and coming back handed out a fresh five. The rule a student
-- actually sees was, in practice, not enforced at all.
--
-- Keyed on the id from the signed httpOnly cookie, like every other per-device
-- record here, so clearing localStorage does nothing to it.
--
-- Written by the server (service_role) only, so RLS is enabled with no policy.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_usage (
  device_id   TEXT PRIMARY KEY,
  used        INTEGER NOT NULL DEFAULT 0,
  reset_at    TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lets expired rows be swept without a full scan.
CREATE INDEX IF NOT EXISTS ai_usage_reset_idx ON ai_usage (reset_at);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
-- No policy: only the service_role (server) may read/write these rows.

-- ────────────────────────────────────────────────────────────────
-- Spending a question, atomically.
--
-- Read-then-write from the application would let two questions sent at once
-- both read the same count and both write count+1 — one free question per
-- race. A single statement cannot be interleaved, so the count is exact.
--
-- The window starts at the first question of a window, not at a fixed hour,
-- so the wait is measured from when the student actually started.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION spend_ai_message(p_device_id TEXT, p_window_secs INTEGER)
RETURNS TABLE (used INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO ai_usage AS u (device_id, used, reset_at, updated_at)
  VALUES (p_device_id, 1, now() + make_interval(secs => p_window_secs), now())
  ON CONFLICT (device_id) DO UPDATE SET
    used = CASE WHEN u.reset_at <= now() THEN 1 ELSE u.used + 1 END,
    reset_at = CASE WHEN u.reset_at <= now()
                    THEN now() + make_interval(secs => p_window_secs)
                    ELSE u.reset_at END,
    updated_at = now()
  RETURNING u.used, u.reset_at;
$$;

REVOKE ALL ON FUNCTION spend_ai_message(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
