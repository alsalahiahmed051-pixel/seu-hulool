import { createAdminClient } from '@/lib/supabase/server'
import { deviceIdentity } from '@/lib/ai-quota'
import { looksLikeEmail } from '@/lib/ai-usage'
import { trackRequestLimit, callerKey } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const TRACK_LOCK_DAYS = 15

/**
 * The server's copy of who this device is.
 *
 * The device id comes from the signed httpOnly cookie, never from the body —
 * otherwise a student could write over someone else's row, or mint a fresh
 * identity per request and walk straight past the track lock.
 *
 * A failure here is never fatal to the app: the profile still works from
 * localStorage. This is the durable copy, not the only one.
 */
export async function POST(request) {
  const rl = await trackRequestLimit.limit(callerKey(request))
  const { deviceId, setCookie } = deviceIdentity(request)
  const reply = (obj, status = 200) => {
    const res = Response.json(obj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }
  // Saving a profile is rare; a flood of writes is not a real student.
  if (!rl.success) return reply({ error: 'محاولات كثيرة — انتظر قليلاً' }, 429)

  const b = await request.json().catch(() => ({}))
  const name = String(b.name || '').trim().slice(0, 120)
  const studentId = String(b.studentId || '').trim().slice(0, 40)
  const email = String(b.email || '').trim().slice(0, 160)
  const track = String(b.track || '').trim().slice(0, 60)
  const college = String(b.college || '').trim().slice(0, 120)
  const plan = String(b.plan || '').trim().slice(0, 120)
  if (email && !looksLikeEmail(email)) return reply({ error: 'بريد غير صحيح' }, 400)

  let db
  // No database configured is not the student's problem: the profile is
  // already saved locally, so report success with nothing stored.
  try { db = createAdminClient() } catch { return reply({ ok: true, stored: false }) }

  // Read first: the confirmed_at already on file decides the lock, so a client
  // cannot restart it by re-sending the profile with a fresh date.
  const { data: existing } = await db
    .from('student_identities')
    .select('track, college, plan, confirmed_at')
    .eq('device_id', deviceId)
    .maybeSingle()

  const sameTrack = existing
    && existing.track === track
    && (existing.college || '') === college
    && (existing.plan || '') === plan
  const heldUntil = existing?.confirmed_at
    ? new Date(existing.confirmed_at).getTime() + TRACK_LOCK_DAYS * 86_400_000
    : 0
  const locked = heldUntil > Date.now()

  // Inside the hold, the track on file wins — unless the owner approved a
  // change that hasn't been spent yet.
  //
  // This lookup is why the approval works at all: the server used to know
  // nothing about it, so it answered "still locked" with the OLD track and the
  // client wrote that back over the student's new choice. The change appeared
  // to save and then silently reverted.
  //
  // Spending is recorded here, not in the browser, and matched on the student's
  // minted code as well as the device — so one approval is one change for that
  // student on every device, and the next change needs a fresh request.
  let approval = null
  if (existing && locked && !sameTrack) {
    const or = [`device_id.eq.${deviceId}`]
    if (studentId) or.push(`student_id.eq.${studentId}`)
    const { data: appr } = await db
      .from('track_requests')
      .select('id, created_at')
      .eq('status', 'approved')
      .is('consumed_at', null)
      .or(or.join(','))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    approval = appr || null
  }

  if (existing && locked && !sameTrack && !approval) {
    const row = {
      device_id: deviceId, full_name: name || null, student_id: studentId || null,
      email: email || null, last_seen: new Date().toISOString(),
    }
    const { error } = await db.from('student_identities').upsert(row, { onConflict: 'device_id' })
    return reply({
      ok: !error, stored: !error, trackLocked: true,
      track: existing.track, college: existing.college, plan: existing.plan,
      confirmedAt: existing.confirmed_at,
      daysLeft: Math.ceil((heldUntil - Date.now()) / 86_400_000),
    })
  }

  // Spend it before writing the new track, and only if it is still unspent:
  // the `is('consumed_at', null)` filter makes two simultaneous saves race for
  // one row, so a second one cannot also claim the same approval.
  if (approval) {
    const { data: claimed } = await db
      .from('track_requests')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', approval.id)
      .is('consumed_at', null)
      .select('id')
      .maybeSingle()
    if (!claimed) {
      return reply({
        ok: true, stored: false, trackLocked: true,
        track: existing.track, college: existing.college, plan: existing.plan,
        confirmedAt: existing.confirmed_at,
        daysLeft: Math.ceil((heldUntil - Date.now()) / 86_400_000),
      })
    }
  }

  const confirmedAt = sameTrack && existing?.confirmed_at
    ? existing.confirmed_at
    : new Date().toISOString()

  const { error } = await db.from('student_identities').upsert({
    device_id: deviceId,
    full_name: name || null,
    student_id: studentId || null,
    email: email || null,
    track: track || null,
    college: college || null,
    plan: plan || null,
    confirmed_at: track ? confirmedAt : null,
    last_seen: new Date().toISOString(),
  }, { onConflict: 'device_id' })

  // A missing table (migration not run) must not block saving a profile.
  if (error) return reply({ ok: true, stored: false, reason: error.message })
  // `approvalSpent` tells the client the change went through under an approval,
  // so it can retire its own banner instead of offering the change again.
  return reply({ ok: true, stored: true, trackLocked: false, confirmedAt, approvalSpent: Boolean(approval) })
}

/** What the server has on file for this device. */
export async function GET(request) {
  const { deviceId, setCookie } = deviceIdentity(request)
  const reply = (obj) => {
    const res = Response.json(obj)
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }
  let db
  try { db = createAdminClient() } catch { return reply({ identity: null }) }

  const { data, error } = await db
    .from('student_identities')
    .select('full_name, student_id, email, track, college, plan, confirmed_at')
    .eq('device_id', deviceId)
    .maybeSingle()
  if (error || !data) return reply({ identity: null })

  const heldUntil = data.confirmed_at
    ? new Date(data.confirmed_at).getTime() + TRACK_LOCK_DAYS * 86_400_000
    : 0
  return reply({
    identity: data,
    daysLeft: heldUntil > Date.now() ? Math.ceil((heldUntil - Date.now()) / 86_400_000) : 0,
  })
}
