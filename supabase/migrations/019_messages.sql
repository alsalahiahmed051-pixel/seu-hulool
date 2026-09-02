-- ════════════════════════════════════════════════════════════════
-- MESSAGES — a conversation, not a suggestion box  (run AFTER 001..018)
--
-- support_messages holds one message and one admin_reply. That shape cannot
-- carry a conversation: the student cannot answer the answer, and — the same
-- bug that track_requests had — nothing ever showed them the reply at all.
--
-- A thread belongs to a person two ways on purpose. user_id is the real one
-- and wins whenever there is a session. device_id is the fallback, because
-- today almost nobody has an account yet, and a student with a problem must
-- be able to reach the owner without one. When accounts land, threads keyed
-- on a device get adopted by the account on that device (see /api/messages).
--
-- Unread is stored per side rather than derived. Deriving it means reading
-- every message of every thread to render one badge; two integers make the
-- badge a single indexed read, and the write that changes them is the same
-- write that inserts the message.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS message_threads (
  id              BIGSERIAL PRIMARY KEY,
  device_id       TEXT,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Copied onto the thread, not joined: the admin needs to know who is
  -- writing even when the student has no profile row at all.
  student_name    TEXT,
  student_id      TEXT,
  email           TEXT,

  -- What started this. 'system' threads are opened by the site itself when a
  -- decision is made, so a rejection arrives as a message the student can
  -- reply to instead of a status they have to go hunting for.
  kind            TEXT NOT NULL DEFAULT 'support'
                  CHECK (kind IN ('support', 'subscription', 'track', 'system')),
  topic           TEXT,
  subject         TEXT,

  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'closed')),

  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  student_unread  INT NOT NULL DEFAULT 0,
  admin_unread    INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id         BIGSERIAL PRIMARY KEY,
  thread_id  BIGINT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL CHECK (sender IN ('student', 'admin')),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS message_threads_device_idx
  ON message_threads (device_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS message_threads_user_idx
  ON message_threads (user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS message_threads_admin_idx
  ON message_threads (last_message_at DESC);
CREATE INDEX IF NOT EXISTS messages_thread_idx
  ON messages (thread_id, created_at);

-- RLS on with no policy is deliberate, and is not an oversight to be "fixed"
-- later by adding a permissive one. These rows are private correspondence:
-- one student's messages must never be readable with the public anon key, and
-- there is no query a browser could run here that is safe. Every read and
-- write goes through /api/messages and /api/admin/messages, which use the
-- service role and check who is asking. Service-role access bypasses RLS, so
-- the tables work while staying closed to the anon key.
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ── Carry over what already exists ──────────────────────────────────────
-- The support inbox has real rows in it. Moving them means the owner does not
-- lose a student's question the day this deploys, and the student finally
-- sees the reply that was written but never delivered.
INSERT INTO message_threads
  (device_id, student_name, student_id, email, kind, topic, subject,
   status, last_message_at, student_unread, admin_unread, created_at)
SELECT
  s.device_id, s.student_name, s.student_id, s.email, 'support', s.topic,
  LEFT(s.message, 60),
  CASE WHEN s.status = 'closed' THEN 'closed' ELSE 'open' END,
  s.updated_at,
  -- An unread reply is exactly what this migration exists to deliver.
  CASE WHEN s.admin_reply IS NOT NULL AND s.admin_reply <> '' THEN 1 ELSE 0 END,
  CASE WHEN s.status = 'new' THEN 1 ELSE 0 END,
  s.created_at
FROM support_messages s
WHERE NOT EXISTS (
  SELECT 1 FROM message_threads t
  WHERE t.created_at = s.created_at AND t.kind = 'support'
);

-- The student's original message, then the reply if one was written.
INSERT INTO messages (thread_id, sender, body, created_at)
SELECT t.id, 'student', s.message, s.created_at
FROM support_messages s
JOIN message_threads t ON t.created_at = s.created_at AND t.kind = 'support'
WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = t.id);

INSERT INTO messages (thread_id, sender, body, created_at)
SELECT t.id, 'admin', s.admin_reply, s.updated_at
FROM support_messages s
JOIN message_threads t ON t.created_at = s.created_at AND t.kind = 'support'
WHERE s.admin_reply IS NOT NULL AND s.admin_reply <> ''
  AND NOT EXISTS (
    SELECT 1 FROM messages m WHERE m.thread_id = t.id AND m.sender = 'admin'
  );
