-- ════════════════════════════════════════════════════════════════
-- SECURITY HARDENING — run AFTER 001/002/003
--
-- The RLS policies in 002_rls_policies.sql correctly restrict *which
-- rows* a user can touch (e.g. "own profile", "own file"), but for
-- UPDATE policies that only specify USING (no WITH CHECK), Postgres
-- reuses the USING expression as the check — which restricts row
-- *ownership*, not *which columns* get changed. A user who owns a row
-- can therefore set any column on it, including ones that were only
-- ever meant to be admin- or system-controlled. This file closes the
-- two privilege-escalation paths that opens up:
--
--   1. profiles.role      — a student could set their own role to
--                            'admin' (full privilege escalation), e.g.
--                            supabase.from('profiles').update({role:'admin'})
--   2. files.is_approved  — an uploader could approve their own file,
--                            skipping moderation entirely, e.g.
--                            supabase.from('files').update({is_approved:true})
--                            (same client-side path also lets them forge
--                            download_count/view_count/rating_*, which
--                            should only move via the trusted RPCs below)
--
-- The fix is a BEFORE UPDATE trigger per table that resets protected
-- columns back to their old value unless the actor is_admin(). Since
-- view_count/download_count/rating_* are legitimately updated by
-- SECURITY DEFINER RPCs called by ordinary (non-admin) users, those
-- RPCs are redefined here to flag their own writes as trusted via a
-- transaction-local GUC, so the trigger lets them through while still
-- blocking a direct client-side .update() call on the same columns.
-- ════════════════════════════════════════════════════════════════

-- ─── 1) profiles.role: only an existing admin/moderator may change it ───
CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_admin() THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON profiles;
CREATE TRIGGER profiles_prevent_role_escalation
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION prevent_self_role_escalation();

-- ─── 2) files: moderation + stat columns are admin/system-only ───
CREATE OR REPLACE FUNCTION protect_files_moderation_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_admin() AND coalesce(current_setting('hulool.trusted_write', true), '') <> 'on' THEN
    NEW.is_approved    := OLD.is_approved;
    NEW.download_count := OLD.download_count;
    NEW.view_count      := OLD.view_count;
    NEW.rating_avg      := OLD.rating_avg;
    NEW.rating_count    := OLD.rating_count;
    NEW.uploaded_by      := OLD.uploaded_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS files_protect_moderation_columns ON files;
CREATE TRIGGER files_protect_moderation_columns
BEFORE UPDATE ON files
FOR EACH ROW EXECUTE FUNCTION protect_files_moderation_columns();

-- ─── Re-flag the trusted system writers so they still work ───
-- (transaction-local — PostgREST/Supabase runs each request in its own
-- transaction, so this can't leak into an unrelated client-issued update)

CREATE OR REPLACE FUNCTION increment_file_view(file_uuid UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('hulool.trusted_write', 'on', true);
  UPDATE files SET view_count = view_count + 1 WHERE id = file_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_download(file_uuid UUID, ua TEXT DEFAULT NULL, ip_h TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  INSERT INTO downloads (user_id, file_id, user_agent, ip_hash)
  VALUES (auth.uid(), file_uuid, ua, ip_h);

  PERFORM set_config('hulool.trusted_write', 'on', true);
  UPDATE files SET download_count = download_count + 1 WHERE id = file_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_file_rating()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM set_config('hulool.trusted_write', 'on', true);
  UPDATE files SET
    rating_avg = (SELECT AVG(rating)::DECIMAL(3,2) FROM file_ratings WHERE file_id = NEW.file_id),
    rating_count = (SELECT COUNT(*) FROM file_ratings WHERE file_id = NEW.file_id)
  WHERE id = NEW.file_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
