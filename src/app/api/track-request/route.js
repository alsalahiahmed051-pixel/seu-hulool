import { createAdminClient } from '@/lib/supabase/server'
import { trackRequestLimit, callerKey } from '@/lib/rate-limit'

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

  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim().slice(0, 120)
  const studentId = String(body.studentId || '').trim().slice(0, 40)
  const currentTrack = String(body.currentTrack || '').trim().slice(0, 200)
  const reason = String(body.reason || '').trim().slice(0, 1000)

  if (!name || !studentId) return Response.json({ error: 'أكمل ملفك أولاً' }, { status: 400 })
  if (!reason) return Response.json({ error: 'سبب التغيير مطلوب' }, { status: 400 })

  let db
  try { db = createAdminClient() } catch { return Response.json({ error: 'الخادم غير مهيّأ' }, { status: 503 }) }

  const { error } = await db.from('track_requests').insert({
    student_name: name,
    student_id: studentId,
    current_track: currentTrack,
    reason,
    status: 'pending',
  })
  if (error) {
    // Most likely the migration hasn't been run yet; say so plainly.
    return Response.json({ error: 'تعذّر حفظ الطلب: ' + error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}
