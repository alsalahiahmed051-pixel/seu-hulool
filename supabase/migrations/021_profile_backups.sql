-- ════════════════════════════════════════════════════════════════
-- PROFILE BACKUPS — recover a device-only account by its ID  (after 001..020)
--
-- The site has no accounts: a student's profile and study data live in their
-- browser. That means clearing the browser, or switching phones, loses
-- everything — and the owner asked for a way back in by the short ID the site
-- mints for each student (SEU-XXXXXX).
--
-- So the whole local store is mirrored here, keyed by that ID. Entering the ID
-- on any device pulls it back. This is a convenience recovery, not an account
-- system: the ID is the only key, the data is a student's own low-sensitivity
-- study material (name, track, tasks, notes), and the redemption route is
-- rate limited so the short ID can't be enumerated at scale.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS profile_backups (
  code        TEXT PRIMARY KEY,           -- the minted student ID, normalised
  data        JSONB NOT NULL,             -- the whole seu_hulool_v2 store blob
  name        TEXT,                       -- for the owner's own reference only
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No policy: RLS on with none defined denies anon and authenticated. Every
-- read and write goes through the service role behind the rate-limited API.
ALTER TABLE profile_backups ENABLE ROW LEVEL SECURITY;
