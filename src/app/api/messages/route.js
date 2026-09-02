import { createAdminClient, createClient } from '@/lib/supabase/server'
import { deviceIdentity } from '@/lib/ai-quota'
import { supportMessageLimit, callerKey } from '@/lib/rate-limit'
import { postMessage, threadOwnerFilter, MAX_BODY } from '@/lib/messages'

export const runtime = 'nodejs'

const TOPICS = ['سؤال', 'مشكلة', 'اقتراح', 'ملف ناقص']

/** The session, when there is one. Never trust a user id from the body. */
async function currentUserId() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
  } catch { return null }
}

/**
 * Adopt this device's threads into the account now signing in.
 *
 * Almost every thread that exists was written before its author had an
 * account. Without this, making an account would silently hide a student's
 * own correspondence from them — the conversation would still be in the
 * admin's inbox, and simply gone from theirs.
 */
async function adoptDeviceThreads(db, { userId, deviceId }) {
  if (!userId || !deviceId) return
  await db.from('message_threads')
    .update({ user_id: userId })
    .eq('device_id', deviceId)
    .is('user_id', null)
}

/** This student's conversations, newest first, with their messages. */
export async function GET(request) {
  const { deviceId, setCookie } = deviceIdentity(request)
  const send = (obj, status = 200) => {
    const res = Response.json(obj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  let db
  try { db = createAdminClient() } catch { return send({ threads: [], unread: 0 }) }

  const userId = await currentUserId()
  await adoptDeviceThreads(db, { userId, deviceId })

  const { data: threads, error } = await threadOwnerFilter(
    db.from('message_threads')
      .select('id, kind, topic, subject, status, student_unread, last_message_at, created_at'),
    { userId, deviceId }
  ).order('last_message_at', { ascending: false }).limit(50)

  if (error) return send({ threads: [], unread: 0, reason: error.message })

  const ids = (threads || []).map(t => t.id)
  let byThread = {}
  if (ids.length) {
    const { data: msgs } = await db
      .from('messages')
      .select('id, thread_id, sender, body, created_at')
      .in('thread_id', ids)
      .order('created_at', { ascending: true })
    for (const m of msgs || []) (byThread[m.thread_id] ||= []).push(m)
  }

  return send({
    threads: (threads || []).map(t => ({ ...t, messages: byThread[t.id] || [] })),
    unread: (threads || []).reduce((n, t) => n + (t.student_unread || 0), 0),
  })
}

/**
 * Write to the owner — either starting a conversation or continuing one.
 *
 * Continuing requires proving the thread is yours. Without that check a
 * thread id is a guessable integer, and posting into someone else's
 * conversation would be a matter of counting.
 */
export async function POST(request) {
  const rl = await supportMessageLimit.limit(callerKey(request))
  const { deviceId, setCookie } = deviceIdentity(request)
  const send = (obj, status = 200) => {
    const res = Response.json(obj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }
  if (!rl.success) {
    const mins = Math.max(1, Math.ceil((rl.reset - Date.now()) / 60000))
    return send({ error: `أرسلت عدة رسائل — يمكنك المحاولة بعد ${mins} دقيقة` }, 429)
  }

  const b = await request.json().catch(() => ({}))
  const body = String(b.body || '').trim().slice(0, MAX_BODY)
  if (!body) return send({ error: 'اكتب رسالتك' }, 400)

  let db
  try { db = createAdminClient() } catch { return send({ error: 'الخادم غير مهيّأ' }, 503) }

  const userId = await currentUserId()

  if (b.threadId) {
    const { data: owned } = await threadOwnerFilter(
      db.from('message_threads').select('id').eq('id', b.threadId),
      { userId, deviceId }
    ).maybeSingle()
    if (!owned) return send({ error: 'المحادثة غير موجودة' }, 404)

    const r = await postMessage(db, { threadId: owned.id, sender: 'student', body })
    return r.ok ? send({ ok: true, threadId: owned.id }) : send({ error: r.error }, 500)
  }

  const { data: thread, error } = await db
    .from('message_threads')
    .insert({
      device_id: deviceId,
      user_id: userId,
      student_name: String(b.name || '').trim().slice(0, 120) || null,
      student_id: String(b.studentId || '').trim().slice(0, 40) || null,
      email: String(b.email || '').trim().slice(0, 160) || null,
      kind: 'support',
      topic: TOPICS.includes(b.topic) ? b.topic : 'سؤال',
      subject: body.slice(0, 60),
      admin_unread: 1,
    })
    .select('id')
    .single()
  if (error || !thread) return send({ error: 'تعذّر إرسال الرسالة: ' + (error?.message || '') }, 500)

  const { error: msgErr } = await db
    .from('messages')
    .insert({ thread_id: thread.id, sender: 'student', body })
  if (msgErr) return send({ error: 'تعذّر إرسال الرسالة' }, 500)

  return send({ ok: true, threadId: thread.id })
}

/** Mark a conversation read. Only ever clears the student's own side. */
export async function PATCH(request) {
  const { deviceId, setCookie } = deviceIdentity(request)
  const send = (obj, status = 200) => {
    const res = Response.json(obj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  const b = await request.json().catch(() => ({}))
  if (!b.threadId) return send({ error: 'threadId مطلوب' }, 400)

  let db
  try { db = createAdminClient() } catch { return send({ ok: false }) }

  const userId = await currentUserId()
  const { data: owned } = await threadOwnerFilter(
    db.from('message_threads').select('id').eq('id', b.threadId),
    { userId, deviceId }
  ).maybeSingle()
  if (!owned) return send({ error: 'المحادثة غير موجودة' }, 404)

  await db.from('message_threads').update({ student_unread: 0 }).eq('id', owned.id)
  return send({ ok: true })
}
