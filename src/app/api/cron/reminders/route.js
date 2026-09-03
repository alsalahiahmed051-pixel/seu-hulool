import { createAdminClient } from '@/lib/supabase/server'
import { sendPushToCode, pushConfigured } from '@/lib/web-push-server'

export const runtime = 'nodejs'
// Never cache — this is invoked on a schedule and must read the live queue.
export const dynamic = 'force-dynamic'

/**
 * The reminder scheduler.
 *
 * Called every minute by Supabase pg_cron (via pg_net) — deliberately, not by
 * Vercel Cron, whose Hobby plan fires at most once a day. It sends every due,
 * unsent reminder to its student's devices and marks it sent. The heavy
 * thinking (what and when) already happened in the browser; this stays dumb.
 *
 * Guarded by CRON_SECRET: without a matching bearer token it does nothing, so
 * the endpoint can't be poked into spamming pushes.
 */

function authorized(request) {
  const secret = (process.env.CRON_SECRET || '').trim()
  if (!secret) return false // fail closed — an unset secret means "not wired yet"
  const header = request.headers.get('authorization') || ''
  return header === `Bearer ${secret}`
}

async function run() {
  if (!pushConfigured()) return { ok: true, skipped: 'push-not-configured' }

  let db
  try { db = createAdminClient() } catch { return { ok: false, error: 'server-unconfigured' } }

  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  // A one-hour floor: a reminder the scheduler somehow missed by more than an
  // hour is stale — firing "your lecture starts in 15 min" two hours late is
  // worse than silence.
  const floorIso = new Date(now - 60 * 60 * 1000).toISOString()

  const { data: due, error } = await db
    .from('push_reminders')
    .select('id, code, title, body, url')
    .is('sent_at', null)
    .lte('fire_at', nowIso)
    .gte('fire_at', floorIso)
    .order('fire_at', { ascending: true })
    .limit(500)
  if (error) return { ok: false, error: error.message }

  let sent = 0
  for (const r of due || []) {
    const res = await sendPushToCode(r.code, { title: r.title, body: r.body, url: r.url })
    if (res.sent > 0) sent += res.sent
    // Mark sent regardless: if the student has no live subscription there is
    // nothing to deliver and retrying every minute only churns. The row is
    // done either way.
    await db.from('push_reminders').update({ sent_at: nowIso }).eq('id', r.id)
  }

  // Sweep rows older than two days (sent, or stale past-floor) so the table
  // stays small.
  const cutoff = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
  await db.from('push_reminders').delete().lt('fire_at', cutoff)

  return { ok: true, due: due?.length || 0, sent }
}

export async function POST(request) {
  if (!authorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401 })
  return Response.json(await run())
}

// GET is allowed too (some schedulers only issue GET), same auth.
export async function GET(request) {
  if (!authorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401 })
  return Response.json(await run())
}
