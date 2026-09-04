import { createAdminClient } from '@/lib/supabase/server'
import { profileBackupLimit, callerKey } from '@/lib/rate-limit'
import { deviceIdentity } from '@/lib/ai-quota'

export const runtime = 'nodejs'

/**
 * Server-side recovery for a device-only account, keyed by the ID the site
 * mints for each student (SEU-XXXXXX).
 *
 * POST mirrors the browser's whole local store here; GET pulls it back on
 * another device. There are no accounts and no passwords — the ID is the only
 * key — so the redemption is rate limited (per caller) to keep the short ID
 * from being enumerated, every failure answers the same, and the stored blob
 * is size-capped. The data is the student's own study material.
 */

// SEU- followed by six of the mint alphabet (no look-alikes). Normalised so a
// pasted lower-case or spaced ID still matches.
function normCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return /^SEU[A-Z0-9]{6}$/.test(s) ? `SEU-${s.slice(3)}` : ''
}

const MAX_BYTES = 512 * 1024 // a whole store blob is a few KB; this is slack.

export async function POST(request) {
  const rl = await profileBackupLimit.limit(callerKey(request))
  if (!rl.success) return Response.json({ error: 'محاولات كثيرة — انتظر قليلاً' }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const code = normCode(body.code)
  if (!code) return Response.json({ error: 'معرّف غير صحيح' }, { status: 400 })

  // "Just remember that this device belongs to this ID."
  //
  // Recording the device only when a backup is *written* meant recovery worked
  // for nobody who already had an account: their row was stored before the
  // column existed, and they have no reason to re-save. This is the cheap call
  // the app makes on open, so any existing device becomes recoverable the next
  // time the student simply opens the site.
  //
  // It updates the link and nothing else — no `data`, so it can never overwrite
  // a store with an empty one — and only for a code that already has a backup.
  if (body.link === true) {
    const { deviceId, setCookie } = deviceIdentity(request)
    if (!deviceId) return Response.json({ ok: false })
    let ldb
    try { ldb = createAdminClient() } catch { return Response.json({ ok: false }) }
    const { data: linked } = await ldb
      .from('profile_backups')
      .update({ device_id: deviceId })
      .eq('code', code)
      .select('code')
      .maybeSingle()
    const res = Response.json({ ok: true, linked: Boolean(linked) })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  const data = body.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return Response.json({ error: 'لا بيانات لحفظها' }, { status: 400 })
  }
  if (JSON.stringify(data).length > MAX_BYTES) {
    return Response.json({ error: 'البيانات كبيرة جداً' }, { status: 413 })
  }

  const name = String(body.name || '').trim().slice(0, 120) || null

  let db
  try { db = createAdminClient() } catch { return Response.json({ error: 'الخادم غير مهيّأ' }, { status: 503 }) }

  // The device is taken from the signed cookie, never the body: it is what
  // "recover my code on this phone" trusts, so a caller must not be able to
  // claim someone else's device and be handed their ID.
  const { deviceId, setCookie } = deviceIdentity(request)

  const { error } = await db.from('profile_backups').upsert(
    { code, data, name, device_id: deviceId || null, updated_at: new Date().toISOString() },
    { onConflict: 'code' }
  )
  if (error) return Response.json({ error: 'تعذّر الحفظ: ' + error.message }, { status: 500 })
  const res = Response.json({ ok: true })
  if (setCookie) res.headers.append('Set-Cookie', setCookie)
  return res
}

export async function GET(request) {
  const rl = await profileBackupLimit.limit(callerKey(request))
  if (!rl.success) return Response.json({ error: 'محاولات كثيرة — انتظر قليلاً' }, { status: 429 })

  const url = new URL(request.url)

  // "I forgot my ID." Answered from the signed device cookie, so it only ever
  // returns IDs that were backed up from this same device — the phone the
  // student still has. No data is returned here, only the IDs and their names,
  // so this cannot be used to read a store; restoring still needs the ID.
  if (url.searchParams.get('recover') === '1') {
    const { deviceId, setCookie } = deviceIdentity(request)
    let rdb
    try { rdb = createAdminClient() } catch { return Response.json({ codes: [] }) }
    let codes = []
    if (deviceId) {
      const { data } = await rdb
        .from('profile_backups')
        .select('code, name, updated_at')
        .eq('device_id', deviceId)
        .order('updated_at', { ascending: false })
        .limit(5)
      codes = data || []

      // Second source: the device's own identity row. A student who saved a
      // profile but whose backup never got linked is still findable here, so
      // recovery does not depend on one table having been written recently.
      const { data: ident } = await rdb
        .from('student_identities')
        .select('student_id, full_name')
        .eq('device_id', deviceId)
        .maybeSingle()
      const identCode = normCode(ident?.student_id)
      if (identCode && !codes.some(c => c.code === identCode)) {
        codes.push({ code: identCode, name: ident.full_name || null, updated_at: null })
      }
    }
    const res = Response.json({ codes })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  const code = normCode(url.searchParams.get('code'))
  // Same answer for a malformed and an unknown ID: nothing to learn by probing.
  if (!code) return Response.json({ data: null })

  let db
  try { db = createAdminClient() } catch { return Response.json({ error: 'الخادم غير مهيّأ' }, { status: 503 }) }

  const { data, error } = await db
    .from('profile_backups').select('data').eq('code', code).maybeSingle()
  if (error) return Response.json({ error: 'تعذّر الاسترجاع' }, { status: 503 })
  return Response.json({ data: data?.data || null })
}
