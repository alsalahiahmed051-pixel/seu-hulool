import { createAdminClient } from '@/lib/supabase/server'
import { subscriptionRequestLimit, callerKey } from '@/lib/rate-limit'
import { deviceIdentity } from '@/lib/ai-quota'
import { looksLikeEmail } from '@/lib/ai-usage'

export const runtime = 'nodejs'

/**
 * A student asking for more assistant messages than the free allowance.
 *
 * The device is taken from the signed cookie, never from the body — otherwise
 * anyone could file a request naming someone else's device, or their own
 * repeatedly under different ids. Open to anyone (the site has no accounts),
 * so it is rate limited per IP and every field is length-capped: these rows
 * are read by an admin.
 */
export async function POST(request) {
  const rl = await subscriptionRequestLimit.limit(callerKey(request))
  if (!rl.success) {
    // Say how long, not just "wait": a refusal with no end in sight reads as
    // a broken button, which is exactly how it was reported.
    const mins = Math.max(1, Math.ceil((rl.reset - Date.now()) / 60000))
    return Response.json({ error: `أرسلت عدة طلبات — يمكنك المحاولة بعد ${mins} دقيقة` }, { status: 429 })
  }

  const { deviceId, setCookie } = deviceIdentity(request)
  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim().slice(0, 120)
  const studentId = String(body.studentId || '').trim().slice(0, 40)
  const email = String(body.email || '').trim().slice(0, 160)
  const note = String(body.note || '').trim().slice(0, 1000)
  const receiptUrl = String(body.receiptUrl || '').trim().slice(0, 600)

  // The site has no email or university number any more — a completed profile
  // is a name plus the minted ID, and that is what a request needs to name who
  // it is from. The result reaches the student in their in-app inbox, so no
  // email is required.
  if (!name) return Response.json({ error: 'أكمل ملفك (الاسم والمسار) من «حسابي» أولاً' }, { status: 400 })
  // A receipt is the whole point of the review, so require something.
  if (!receiptUrl && !note) return Response.json({ error: 'أرفق إيصال التحويل أو اكتب ملاحظة' }, { status: 400 })

  let db
  try { db = createAdminClient() } catch { return Response.json({ error: 'الخادم غير مهيّأ' }, { status: 503 }) }

  const reply = (obj, status = 200) => {
    const res = Response.json(obj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  // One open request at a time — a queue of duplicates helps nobody.
  const { data: open } = await db
    .from('ai_subscriptions')
    .select('id')
    .eq('device_id', deviceId)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()
  if (open) return reply({ error: 'لديك طلب قيد المراجعة بالفعل' }, 409)

  const { error } = await db.from('ai_subscriptions').insert({
    device_id: deviceId,
    student_name: name,
    student_id: studentId,
    email,
    note,
    receipt_url: receiptUrl || null,
    status: 'pending',
  })
  if (error) {
    // Most likely the migration hasn't been run yet; say so plainly.
    return reply({ error: 'تعذّر حفظ الطلب: ' + error.message }, 500)
  }
  return reply({ ok: true })
}

/** The student checking on their own request. */
export async function GET(request) {
  const { deviceId, setCookie } = deviceIdentity(request)
  let db
  try { db = createAdminClient() } catch { return Response.json({ request: null }) }

  const { data } = await db
    .from('ai_subscriptions')
    .select('status, admin_reply, expires_at, created_at')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const res = Response.json({ request: data || null })
  if (setCookie) res.headers.append('Set-Cookie', setCookie)
  return res
}
