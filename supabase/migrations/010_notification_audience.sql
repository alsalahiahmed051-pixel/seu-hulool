-- ════════════════════════════════════════════════════════════════
-- TARGETED BROADCASTS — run AFTER 001..009
--
-- Adds an audience tag to broadcast notifications so an admin can send an
-- announcement to everyone, a whole track, or a specific plan. Values:
--   'all'                      → everyone
--   'track:<track>'            → e.g. track:تحضيري
--   'plan:<track>|<plan>'      → e.g. plan:تحضيري|خطة أ
-- The app filters by the student's saved profile client-side.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'all';
