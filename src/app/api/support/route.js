import { createAdminClient } from '@/lib/supabase/server'
import { supportMessageLimit, callerKey } from '@/lib/rate-limit'
import { deviceIdentity } from '@/lib/ai-quota'

export const runtime = 'nodejs'

const TOPICS = ['سؤال', 'مشكلة', 'اقتراح', 'ملف ناقص']

/**
 * A student writing to whoever runs the site.
 *
 * Open to anyone — the point is that a student with a problem can reach you
 * without an account — so it is rate limited per caller and every field is
 * length-capped: these rows are read by an admin.
 */
export async function POST(request) {
  const rl = await supportMessageLimit.limit(callerKey(request))
  if (!rl.success) {
    const mins = Math.max(1, Math.ceil((rl.reset - Date.now()) / 60000))
    return Response.json({ error: `أرسلت عدة رسائل — يمكنك المحاولة بعد ${mins} دقيقة` }, { status: 429 })
  }

  const { deviceId, setCookie } = deviceIdentity(request)
  const reply = (obj, status = 200) => {
    const res = Response.json(obj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  const b = await request.json().catch(() => ({}))
  const message = String(b.message || '').trim().slice(0, 2000)
  if (!message) return reply({ error: 'اكتب رسالتك' }, 400)

  const topic = TOPICS.includes(b.topic) ? b.topic : 'سؤال'

  let db
  try { db = createAdminClient() } catch { return reply({ error: 'الخادم غير مهيّأ' }, 503) }

  const { error } = await db.from('support_messages').insert({
    device_id: deviceId,
    student_name: String(b.name || '').trim().slice(0, 120) || null,
    student_id: String(b.studentId || '').trim().slice(0, 40) || null,
    email: String(b.email || '').trim().slice(0, 160) || null,
    topic,
    message,
    page: String(b.page || '').trim().slice(0, 60) || null,
    status: 'new',
  })
  if (error) {
    // Most likely the migration hasn't been run yet; say so plainly.
    return reply({ error: 'تعذّر إرسال الرسالة: ' + error.message }, 500)
  }
  return reply({ ok: true })
}
