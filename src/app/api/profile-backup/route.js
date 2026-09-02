import { createAdminClient } from '@/lib/supabase/server'
import { profileBackupLimit, callerKey } from '@/lib/rate-limit'

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

  const { error } = await db.from('profile_backups').upsert(
    { code, data, name, updated_at: new Date().toISOString() },
    { onConflict: 'code' }
  )
  if (error) return Response.json({ error: 'تعذّر الحفظ: ' + error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function GET(request) {
  const rl = await profileBackupLimit.limit(callerKey(request))
  if (!rl.success) return Response.json({ error: 'محاولات كثيرة — انتظر قليلاً' }, { status: 429 })

  const code = normCode(new URL(request.url).searchParams.get('code'))
  // Same answer for a malformed and an unknown ID: nothing to learn by probing.
  if (!code) return Response.json({ data: null })

  let db
  try { db = createAdminClient() } catch { return Response.json({ error: 'الخادم غير مهيّأ' }, { status: 503 }) }

  const { data, error } = await db
    .from('profile_backups').select('data').eq('code', code).maybeSingle()
  if (error) return Response.json({ error: 'تعذّر الاسترجاع' }, { status: 503 })
  return Response.json({ data: data?.data || null })
}
