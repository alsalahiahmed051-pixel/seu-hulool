import { createAdminClient } from '@/lib/supabase/server'

/**
 * Shared helpers for the message system.
 *
 * Both sides of a conversation — the student's route and the admin's — write
 * the same three things on every message: the row, the thread's timestamp,
 * and the other side's unread count. Doing that in one place is the only way
 * those three stay in step; a reply that lands without bumping
 * `student_unread` is a reply the student is never told about, which is the
 * exact failure this whole feature was built to end.
 */

/** Longest message we will store. Long enough for a real question. */
export const MAX_BODY = 4000

/**
 * Who is asking, in the order that identity actually resolves.
 *
 * A session wins outright. Without one the signed device cookie stands in,
 * because a student with a problem has to be able to reach the owner before
 * they have an account — that is when they are most likely to need to.
 */
export function threadOwnerFilter(query, { userId, deviceId }) {
  return userId ? query.eq('user_id', userId) : query.eq('device_id', deviceId)
}

/**
 * Append a message and move the thread's counters with it.
 *
 * `sender` decides which side becomes unread: a student's message is unread
 * for the admin, and the admin's is unread for the student. Never both.
 */
export async function postMessage(db, { threadId, sender, body }) {
  const text = String(body || '').trim().slice(0, MAX_BODY)
  if (!text) return { ok: false, error: 'الرسالة فارغة' }

  const { error: insErr } = await db
    .from('messages')
    .insert({ thread_id: threadId, sender, body: text })
  if (insErr) return { ok: false, error: insErr.message }

  // Read-then-write on a counter races with itself, so the increment goes
  // through SQL rather than JavaScript. Two messages arriving together would
  // otherwise both read the same number and both write it plus one, and the
  // badge would undercount exactly when the inbox is busiest.
  const { error: bumpErr } = await db.rpc('bump_thread', {
    p_thread_id: threadId,
    p_for_admin: sender === 'student',
  })
  if (bumpErr) return { ok: false, error: bumpErr.message }

  return { ok: true }
}

/**
 * Open a thread on the student's behalf because something happened to them.
 *
 * This is how a rejected subscription or an answered request reaches a person:
 * as a message they can reply to, in the same inbox as everything else, rather
 * than a status buried on a page they would have to think to revisit.
 *
 * Failure is deliberately soft. The decision itself has already been recorded
 * by the caller; if the notice cannot be written, the admin's action must
 * still stand rather than being rolled back over a message.
 */
export async function openSystemThread({
  deviceId = null, userId = null, name = null, studentId = null, email = null,
  kind = 'system', subject, body,
}) {
  let db
  try { db = createAdminClient() } catch { return { ok: false, error: 'not configured' } }

  const { data, error } = await db
    .from('message_threads')
    .insert({
      device_id: deviceId, user_id: userId,
      student_name: name, student_id: studentId, email,
      kind, subject: String(subject || '').slice(0, 120),
      student_unread: 1,
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message || 'no thread' }

  const { error: msgErr } = await db
    .from('messages')
    .insert({ thread_id: data.id, sender: 'admin', body: String(body || '').slice(0, MAX_BODY) })
  if (msgErr) return { ok: false, error: msgErr.message }

  return { ok: true, threadId: data.id }
}
