import { createAdminClient } from '@/lib/supabase/server'
import { profileBackupLimit, callerKey } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * The browser mirrors its upcoming reminders here so the scheduler can deliver
 * them while the site is closed. The client owns the timing (it computes each
 * reminder's absolute instant in the student's own zone); this route only
 * stores the list, keyed by the minted student ID.
 *
 * A sync is a clean replace of that student's *future, unsent* reminders:
 * editing a task or lecture re-syncs and the old pending row is dropped, while
 * rows already sent stay put so the same reminder never fires twice.
 *
 * No accounts, so the ID is the only key — rate limited (per caller) and
 * capped, like the profile backup it rides alongside.
 */

// SEU- followed by six of the mint alphabet; normalised so a pasted/spaced ID
// still matches. Same shape the profile backup validates.
function normCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return /^SEU[A-Z0-9]{6}$/.test(s) ? `SEU-${s.slice(3)}` : ''
}

const MAX_REMINDERS = 400 // a 14-day horizon of lectures + tasks is far under this.

export async function POST(request) {
  const rl = await profileBackupLimit.limit(callerKey(request))
  if (!rl.success) return Response.json({ error: 'محاولات كثيرة — انتظر قليلاً' }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const code = normCode(body.code)
  if (!code) return Response.json({ error: 'معرّف غير صحيح' }, { status: 400 })

  const incoming = Array.isArray(body.reminders) ? body.reminders.slice(0, MAX_REMINDERS) : []

  const rows = []
  for (const r of incoming) {
    const fire = new Date(r?.fire_at)
    if (Number.isNaN(fire.getTime())) continue
    // Only keep future instants — a stale one would fire the moment it lands.
    if (fire.getTime() <= Date.now()) continue
    const dedup = String(r?.dedup_key || '').slice(0, 120)
    if (!dedup) continue
    rows.push({
      code,
      dedup_key: dedup,
      title: String(r?.title || 'حلول').slice(0, 120),
      body: String(r?.body || '').slice(0, 300),
      url: String(r?.url || '/').slice(0, 300),
      fire_at: fire.toISOString(),
    })
  }

  let db
  try { db = createAdminClient() } catch { return Response.json({ error: 'الخادم غير مهيّأ' }, { status: 503 }) }

  // Replace this student's pending future reminders. Sent rows (sent_at set)
  // are left alone so nothing re-fires; past unsent rows are swept too.
  const del = await db
    .from('push_reminders')
    .delete()
    .eq('code', code)
    .is('sent_at', null)
  if (del.error) return Response.json({ error: 'تعذّرت المزامنة: ' + del.error.message }, { status: 500 })

  if (rows.length) {
    // A dedup_key already present as a *sent* row would collide on the unique
    // key; ignore those so an old, already-delivered occurrence isn't resent.
    const ins = await db
      .from('push_reminders')
      .upsert(rows, { onConflict: 'code,dedup_key', ignoreDuplicates: true })
    if (ins.error) return Response.json({ error: 'تعذّرت المزامنة: ' + ins.error.message }, { status: 500 })
  }

  return Response.json({ ok: true, count: rows.length })
}
