import { createAdminClient } from '@/lib/supabase/server'
import { trackRequestLimit, callerKey } from '@/lib/rate-limit'
import { deviceIdentity } from '@/lib/ai-quota'

export const runtime = 'nodejs'

/**
 * A student asking to change their track before the lock expires.
 *
 * Open to anyone (the site has no accounts), so it is rate limited per IP and
 * every field is length-capped — this writes rows an admin will read.
 */
export async function POST(request) {
  const rl = await trackRequestLimit.limit(callerKey(request))
  if (!rl.success) {
    return Response.json({ error: 'أرسلت طلباً للتو — انتظر قليلاً' }, { status: 429 })
  }

  const { deviceId, setCookie } = deviceIdentity(request)
  const reply = (obj, status = 200) => {
    const res = Response.json(obj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim().slice(0, 120)
  const studentId = String(body.studentId || '').trim().slice(0, 40)
  const currentTrack = String(body.currentTrack || '').trim().slice(0, 200)
  const reason = String(body.reason || '').trim().slice(0, 1000)

  // The university number is no longer asked for anywhere, so requiring it
  // here would reject every request the site is now capable of sending. The
  // column stays for the rows that already carry one.
  if (!name) return reply({ error: 'أكمل ملفك أولاً' }, 400)
  if (!reason) return reply({ error: 'سبب التغيير مطلوب' }, 400)

  let db
  try { db = createAdminClient() } catch { return reply({ error: 'الخادم غير مهيّأ' }, 503) }

  const { error } = await db.from('track_requests').insert({
    device_id: deviceId,
    student_name: name,
    student_id: studentId,
    current_track: currentTrack,
    reason,
    status: 'pending',
  })
  if (error) {
    // Most likely the migration hasn't been run yet; say so plainly.
    return reply({ error: 'تعذّر حفظ الطلب: ' + error.message }, 500)
  }
  return reply({ ok: true })
}

/**
 * The student reading the answer to their own request.
 *
 * The admin panel has been able to write admin_reply for a while; nothing
 * ever showed it, because a row records a name and a university number and
 * neither identifies the caller. Keyed on the signed device cookie, so the
 * answer reaches the person who asked and nobody else.
 */
export async function GET(request) {
  const { deviceId, setCookie } = deviceIdentity(request)
  const send = (obj) => {
    const res = Response.json(obj)
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  let db
  try { db = createAdminClient() } catch { return send({ request: null }) }

  const { data } = await db
    .from('track_requests')
    .select('status, reason, admin_reply, current_track, created_at, updated_at, consumed_at')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return send({ request: data || null })
}
