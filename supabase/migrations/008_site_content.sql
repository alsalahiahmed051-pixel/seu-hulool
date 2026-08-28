-- ════════════════════════════════════════════════════════════════
-- EDITABLE SITE CONTENT — run AFTER 001..007
--
-- A tiny key -> JSON store for admin-editable page content (starting
-- with the Links page: portal links, support phone/hours/days, header
-- and footer text). Everyone can READ it (the app renders it for all
-- visitors, logged in or not); only the admin API (service_role) writes.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS site_content (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read site_content" ON site_content;
CREATE POLICY "public read site_content" ON site_content
  FOR SELECT USING (true);

GRANT SELECT ON site_content TO anon, authenticated;
GRANT ALL ON site_content TO service_role;
