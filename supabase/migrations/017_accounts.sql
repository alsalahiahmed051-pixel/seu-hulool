-- ════════════════════════════════════════════════════════════════
-- REAL STUDENT ACCOUNTS — run AFTER 001..016
--
-- Until now a student was a JSON blob in localStorage, mirrored to
-- student_identities under a signed device cookie. There was no verified
-- email, so no recovery and no way to reach anyone; and the 15-day track hold
-- rested on a cookie. This turns the dormant Supabase Auth scaffolding
-- (auth.users + profiles + the on_auth_user_created trigger) into the real
-- identity, and closes the hole that made it unsafe to switch on.
-- ════════════════════════════════════════════════════════════════

-- ── 1. The columns the app needs ────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS student_code TEXT,           -- SEU-26-7K3M, generated
  ADD COLUMN IF NOT EXISTS plan         TEXT,           -- خطة أ / a programme name
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,    -- anchor for the 15-day hold
  -- These two are written by useSyncedSetting today and have never existed,
  -- so every write failed silently into a swallowed promise. Nobody noticed
  -- because nobody was ever logged in.
  ADD COLUMN IF NOT EXISTS schedule_view   TEXT,
  ADD COLUMN IF NOT EXISTS notif_sound_on  BOOLEAN DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_code_key
  ON profiles (student_code) WHERE student_code IS NOT NULL;

-- ── 2. Close the profile-reading hole ───────────────────────────
-- The old policy was FOR SELECT USING (true): every column of every profile
-- was world-readable, `role` included. Harmless while nobody had an account;
-- live exposure the moment students do.
DROP POLICY IF EXISTS "Users can view all profiles (public info)" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());

-- ── 3. The student code ─────────────────────────────────────────
-- Year of joining plus four characters, from an alphabet with no 0/O/1/I so
-- it survives being read aloud or copied off a screen. Random rather than
-- sequential: a counter would publish both the headcount and the join order.
CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate TEXT;
  i INTEGER;
BEGIN
  -- 31^4 ≈ 924k per year; collisions are rare and simply retried.
  FOR attempt IN 1..40 LOOP
    candidate := 'SEU-' || to_char(now(), 'YY') || '-';
    FOR i IN 1..4 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE student_code = candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;
  -- Never hand back a duplicate: fall through to something guaranteed unique.
  RETURN 'SEU-' || to_char(now(), 'YY') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
END;
$$;

-- ── 4. Give every account a code, old and new ───────────────────
-- The existing trigger already fills full_name from the signup metadata; it
-- just never had a code to assign.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url, student_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    generate_student_code()
  );
  RETURN NEW;
END;
$$;

UPDATE profiles SET student_code = generate_student_code() WHERE student_code IS NULL;
