-- ════════════════════════════════════════════════════════════════
-- NAME-KEYED FAVORITES / NOTES — run AFTER 001..006
--
-- The whole app UI identifies a course by its Arabic name string, not
-- by a UUID. The original `favorites`/`notes` tables key on a course
-- UUID (FK to courses.id), which never matched how the frontend works,
-- so they were never usable. These two small tables key on the course
-- *name* instead, matching the UI exactly, so favorites/notes can sync
-- per-user across devices without the (large, separate) "courses from
-- the database" overhaul.
--
-- Per-user, RLS-restricted to the owner. Grants include authenticated
-- (the app) and service_role (admin tooling), consistent with 005/006.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS app_favorites (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, subject)
);
ALTER TABLE app_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own app_favorites" ON app_favorites;
CREATE POLICY "own app_favorites" ON app_favorites
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT ALL ON app_favorites TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS app_notes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  content TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, subject)
);
ALTER TABLE app_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own app_notes" ON app_notes;
CREATE POLICY "own app_notes" ON app_notes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT ALL ON app_notes TO authenticated, service_role;
