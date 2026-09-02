-- ════════════════════════════════════════════════════════════════
-- LOGIN CODES — a way in when email does not arrive  (run AFTER 001..019)
--
-- Sign-up depends on a six-digit code reaching the student's inbox, and the
-- site's outgoing mail is its weakest link. A student who never receives that
-- code has no route in at all — and the owner had no way to let them in.
--
-- So the owner issues a code by hand and sends it however they already talk to
-- the student. Redeeming it creates a session through Supabase's own magic-link
-- machinery with no mail sent (see /api/login-code).
--
-- Two decisions worth stating:
--
-- The code is stored hashed, never in the clear. A table an admin can re-read
-- to recover a code is a table worth stealing; the panel shows the code once,
-- at the moment it is issued, and after that it genuinely cannot be shown.
-- Losing one before delivery costs a revoke and a re-issue, which is cheap.
--
-- Redemption is one statement, not read-then-write. "Single use" is only true
-- if two requests carrying the same code cannot both find it unused; the UPDATE
-- ... WHERE used_at IS NULL RETURNING below is what makes exactly one of them
-- win.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS login_codes (
  id          BIGSERIAL PRIMARY KEY,

  -- Keyed HMAC of the code (see src/lib/login-codes.js), never the code.
  code_hash   TEXT NOT NULL UNIQUE,

  -- Who it lets in. The account is created on first redemption if new.
  email       TEXT NOT NULL,

  -- The owner's own note — "نينيز — تحضيري" — so a list of codes is readable.
  label       TEXT,

  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,

  -- Failed tries against this hash. A code being probed shows up in the panel
  -- even though every attempt was refused.
  attempts    INT NOT NULL DEFAULT 0
);

-- code_hash is already indexed by its UNIQUE constraint, which is the lookup
-- redemption uses; these two are for the panel's list and its per-student view.
CREATE INDEX IF NOT EXISTS login_codes_created_idx ON login_codes(created_at DESC);
CREATE INDEX IF NOT EXISTS login_codes_email_idx ON login_codes(email);

-- No policy is deliberate: RLS on with none defined denies anon and
-- authenticated outright. Every read and write here goes through the service
-- role, behind requireAdmin or behind the rate-limited redemption route.
ALTER TABLE login_codes ENABLE ROW LEVEL SECURITY;

-- ── Redeem: atomic, single-use, and silent about why it failed ──────────
-- Returns the email on success and NULL for every failure — unknown, expired
-- and already-used are indistinguishable to the caller on purpose, so probing
-- cannot tell someone which of their guesses was once a real code.
CREATE OR REPLACE FUNCTION redeem_login_code(p_hash TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE login_codes
     SET used_at = NOW()
   WHERE code_hash = p_hash
     AND used_at IS NULL
     AND expires_at > NOW()
  RETURNING email;
$$;

CREATE OR REPLACE FUNCTION bump_code_attempt(p_hash TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE login_codes SET attempts = attempts + 1 WHERE code_hash = p_hash;
$$;

-- SECURITY DEFINER runs as the owner, so these must not be callable by the
-- public roles: redeem_login_code hands out a session, and left open it would
-- be an unauthenticated oracle over the whole table.
REVOKE ALL ON FUNCTION redeem_login_code(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bump_code_attempt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_login_code(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION bump_code_attempt(TEXT) TO service_role;
