-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) POLICIES
-- This file MUST be run AFTER 001_initial_schema.sql
-- ════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gpa_semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_quota ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Helper: is current user an admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ════════════════════════════════════════════════════════════════
-- PROFILES
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Users can view all profiles (public info)"
ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
ON profiles FOR UPDATE USING (is_admin());

-- ════════════════════════════════════════════════════════════════
-- COLLEGES & COURSES — public read, admin write
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Anyone can view colleges"
ON colleges FOR SELECT USING (true);

CREATE POLICY "Admins manage colleges"
ON colleges FOR ALL USING (is_admin());

CREATE POLICY "Anyone can view active courses"
ON courses FOR SELECT USING (is_active = true OR is_admin());

CREATE POLICY "Admins manage courses"
ON courses FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins update courses"
ON courses FOR UPDATE USING (is_admin());

CREATE POLICY "Admins delete courses"
ON courses FOR DELETE USING (is_admin());

-- ════════════════════════════════════════════════════════════════
-- FILES — authenticated users see approved files, admins see all
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Authenticated users see approved files"
ON files FOR SELECT USING (
  auth.role() = 'authenticated' AND (is_approved = true OR uploaded_by = auth.uid() OR is_admin())
);

CREATE POLICY "Authenticated users can upload files"
ON files FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND uploaded_by = auth.uid()
);

CREATE POLICY "Users can update their own files"
ON files FOR UPDATE USING (uploaded_by = auth.uid() OR is_admin());

CREATE POLICY "Admins can delete files"
ON files FOR DELETE USING (is_admin());

-- ════════════════════════════════════════════════════════════════
-- FAVORITES — users only see/manage their own
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Users manage own favorites"
ON favorites FOR ALL USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- NOTES — strictly personal
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Users manage own notes"
ON notes FOR ALL USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- SESSIONS — strictly personal
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Users manage own sessions"
ON sessions FOR ALL USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- GPA SEMESTERS — strictly personal
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Users manage own GPA semesters"
ON gpa_semesters FOR ALL USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- FILE RATINGS — anyone reads, only own user writes
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Anyone can view ratings"
ON file_ratings FOR SELECT USING (true);

CREATE POLICY "Users manage own ratings"
ON file_ratings FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own ratings"
ON file_ratings FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users delete own ratings"
ON file_ratings FOR DELETE USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- DOWNLOADS — users see their own, admins see all
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Users see own downloads"
ON downloads FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert downloads"
ON downloads FOR INSERT WITH CHECK (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- NOTIFICATIONS — user sees own + broadcasts (user_id IS NULL)
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Users see own notifications and broadcasts"
ON notifications FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can mark own notifications read"
ON notifications FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can create notifications"
ON notifications FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can delete notifications"
ON notifications FOR DELETE USING (is_admin());

-- ════════════════════════════════════════════════════════════════
-- CHAT MESSAGES — strictly personal
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Users see own chat"
ON chat_messages FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users insert own chat"
ON chat_messages FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own chat quota"
ON chat_quota FOR ALL USING (user_id = auth.uid() OR is_admin());

-- ════════════════════════════════════════════════════════════════
-- ACHIEVEMENTS — users see own + others' public unlocks
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Anyone can view achievements"
ON user_achievements FOR SELECT USING (true);

CREATE POLICY "Users insert own achievements"
ON user_achievements FOR INSERT WITH CHECK (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS (run separately in Supabase Storage section)
-- ════════════════════════════════════════════════════════════════
-- 1. Create bucket 'course-files' (PRIVATE, not public!)
-- 2. Create bucket 'avatars' (PUBLIC)
-- 3. Apply these policies:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('course-files', 'course-files', false, 52428800, ARRAY['application/pdf']::text[]),
  ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

-- Course files: anyone authenticated can read; only admin can upload
CREATE POLICY "Authenticated users can download approved files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'course-files'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Admins can upload course files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-files'
  AND is_admin()
);

CREATE POLICY "Admins can delete course files"
ON storage.objects FOR DELETE
USING (bucket_id = 'course-files' AND is_admin());

-- Avatars: users upload their own
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
