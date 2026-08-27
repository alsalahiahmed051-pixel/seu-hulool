-- ════════════════════════════════════════════════════════════════
-- GRANT TABLE PRIVILEGES — run AFTER 001/002/003/004
--
-- Found live: every single application table had ZERO grants for the
-- `authenticated` and `anon` roles. RLS policies (002_rls_policies.sql)
-- only ever restrict *which rows* a role can see once that role already
-- has the base table-level privilege — Postgres checks GRANTs first and
-- blocks the query entirely before RLS policies are even evaluated if
-- that base privilege is missing. 002 defined a full, correct set of
-- per-row policies but never issued the GRANT statements Postgres
-- requires underneath them, so PostgREST returned "permission denied
-- for table X" for every authenticated request to any of these tables
-- — nothing backend-connected (favorites, notes, sessions, profile
-- reads, the /admin role check, etc.) could ever have worked.
--
-- This grants the standard Supabase pattern: broad table-level access
-- to authenticated/anon, with the existing RLS policies from 002 still
-- doing all the real per-row restriction (e.g. `files` still requires
-- auth.role() = 'authenticated' inside its own policy regardless of
-- anon's table-level SELECT grant here).
-- ════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- So any table added by a future migration gets the same treatment
-- automatically, instead of silently repeating this exact bug.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
