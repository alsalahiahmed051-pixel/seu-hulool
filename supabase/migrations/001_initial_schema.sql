-- ════════════════════════════════════════════════════════════════
-- HULOOL SEU — Initial Database Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ════════════════════════════════════════════════════════════════

-- Enable extensions we need
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy Arabic search

-- ════════════════════════════════════════════════════════════════
-- PROFILES (extends Supabase auth.users)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  university_id TEXT,  -- Student ID
  track TEXT CHECK (track IN ('preparatory', 'bachelor', 'diploma', 'graduate')),
  college_id TEXT,
  program TEXT,
  weekly_goal INTEGER DEFAULT 15 CHECK (weekly_goal BETWEEN 3 AND 100),
  dark_mode BOOLEAN DEFAULT true,
  sound_on BOOLEAN DEFAULT true,
  onboarded BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'admin', 'moderator')),
  total_sessions INTEGER DEFAULT 0,
  total_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX profiles_track_idx ON profiles(track);
CREATE INDEX profiles_role_idx ON profiles(role);

-- ════════════════════════════════════════════════════════════════
-- COLLEGES
-- ════════════════════════════════════════════════════════════════
CREATE TABLE colleges (
  id TEXT PRIMARY KEY,           -- e.g., 'admin', 'cs', 'health'
  name_ar TEXT NOT NULL,
  name_en TEXT,
  icon TEXT,                     -- lucide icon name
  color TEXT,                    -- hex color
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════
-- COURSES / PROGRAMS
-- ════════════════════════════════════════════════════════════════
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,     -- url-safe identifier, e.g. 'computing-prep-a'
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  track TEXT NOT NULL CHECK (track IN ('preparatory', 'bachelor', 'diploma', 'graduate')),
  college_id TEXT REFERENCES colleges(id) ON DELETE SET NULL,
  plan TEXT,                     -- 'a' or 'b' for preparatory
  icon TEXT,                     -- lucide icon name
  color TEXT,
  credit_hours INTEGER,
  level INTEGER,                 -- Level/semester (1-8)
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX courses_track_idx ON courses(track);
CREATE INDEX courses_college_idx ON courses(college_id);
CREATE INDEX courses_slug_idx ON courses(slug);
CREATE INDEX courses_name_trgm_idx ON courses USING gin (name_ar gin_trgm_ops);

-- ════════════════════════════════════════════════════════════════
-- FILES (PDFs, summaries, etc.)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('collections', 'plans', 'curriculum', 'programs')),
  title TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,    -- Path in Supabase Storage
  file_type TEXT DEFAULT 'pdf',
  file_size_bytes BIGINT,
  semester TEXT,                 -- e.g., '1445/2'
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  download_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  rating_avg DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  is_approved BOOLEAN DEFAULT false,  -- Moderation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX files_course_idx ON files(course_id);
CREATE INDEX files_category_idx ON files(category);
CREATE INDEX files_approved_idx ON files(is_approved);
CREATE INDEX files_title_trgm_idx ON files USING gin (title gin_trgm_ops);

-- ════════════════════════════════════════════════════════════════
-- FAVORITES
-- ════════════════════════════════════════════════════════════════
CREATE TABLE favorites (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX favorites_user_idx ON favorites(user_id);

-- ════════════════════════════════════════════════════════════════
-- NOTES (personal notes per course)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX notes_user_idx ON notes(user_id);

-- ════════════════════════════════════════════════════════════════
-- STUDY SESSIONS (Pomodoro log)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX sessions_user_date_idx ON sessions(user_id, session_date);
CREATE INDEX sessions_user_idx ON sessions(user_id);

-- ════════════════════════════════════════════════════════════════
-- GPA SEMESTERS (saved semesters)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE gpa_semesters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  courses JSONB NOT NULL,        -- [{ name, score, hrs }]
  gpa DECIMAL(3,2) NOT NULL,
  total_hours INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX gpa_user_idx ON gpa_semesters(user_id);

-- ════════════════════════════════════════════════════════════════
-- FILE RATINGS
-- ════════════════════════════════════════════════════════════════
CREATE TABLE file_ratings (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, file_id)
);

-- Trigger to maintain rating_avg on files
CREATE OR REPLACE FUNCTION update_file_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE files SET
    rating_avg = (SELECT AVG(rating)::DECIMAL(3,2) FROM file_ratings WHERE file_id = NEW.file_id),
    rating_count = (SELECT COUNT(*) FROM file_ratings WHERE file_id = NEW.file_id)
  WHERE id = NEW.file_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER file_rating_update_trigger
AFTER INSERT OR UPDATE OR DELETE ON file_ratings
FOR EACH ROW EXECUTE FUNCTION update_file_rating();

-- ════════════════════════════════════════════════════════════════
-- DOWNLOADS LOG (analytics + abuse prevention)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_hash TEXT  -- Hashed for privacy
);

CREATE INDEX downloads_user_idx ON downloads(user_id);
CREATE INDEX downloads_file_idx ON downloads(file_id);
CREATE INDEX downloads_date_idx ON downloads(downloaded_at);

-- ════════════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ════════════════════════════════════════════════════════════════
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL = broadcast
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'new_file', 'announcement')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link_url TEXT,
  icon TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX notifications_user_idx ON notifications(user_id, is_read);
CREATE INDEX notifications_broadcast_idx ON notifications(user_id) WHERE user_id IS NULL;

-- ════════════════════════════════════════════════════════════════
-- CHAT HISTORY (AI conversations - for monitoring abuse + cost)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX chat_user_idx ON chat_messages(user_id);
CREATE INDEX chat_date_idx ON chat_messages(created_at);

-- Daily chat quota tracking
CREATE TABLE chat_quota (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  quota_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, quota_date)
);

-- ════════════════════════════════════════════════════════════════
-- ACHIEVEMENTS
-- ════════════════════════════════════════════════════════════════
CREATE TABLE user_achievements (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

-- ════════════════════════════════════════════════════════════════
-- AUTO-UPDATE timestamp trigger
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER courses_updated BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER files_updated BEFORE UPDATE ON files FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER notes_updated BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- AUTO-CREATE PROFILE on signup
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ════════════════════════════════════════════════════════════════
-- INCREMENT view_count when file is viewed
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_file_view(file_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE files SET view_count = view_count + 1 WHERE id = file_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════
-- INCREMENT view_count when course is viewed
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_course_view(course_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE courses SET view_count = view_count + 1 WHERE id = course_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════
-- LOG DOWNLOAD + increment counter atomically
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION log_download(file_uuid UUID, ua TEXT DEFAULT NULL, ip_h TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  INSERT INTO downloads (user_id, file_id, user_agent, ip_hash)
  VALUES (auth.uid(), file_uuid, ua, ip_h);

  UPDATE files SET download_count = download_count + 1 WHERE id = file_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════
-- UPDATE session totals on insert
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_session_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET
    total_sessions = total_sessions + 1,
    total_minutes = total_minutes + NEW.duration_minutes
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sessions_update_totals
AFTER INSERT ON sessions
FOR EACH ROW EXECUTE FUNCTION update_session_totals();
