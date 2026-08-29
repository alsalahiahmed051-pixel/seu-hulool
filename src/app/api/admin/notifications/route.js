import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushToAudience, pushConfigured } from '@/lib/web-push-server'

export const runtime = 'nodejs'

const TYPES = ['info', 'announcement', 'warning', 'success']

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()
  // Broadcasts only (user_id IS NULL) — the ones an admin sends to everyone.
  const run = (cols) => db
    .from('notifications')
    .select(cols)
    .is('user_id', null)
    .order('created_at', { ascending: false })
    .limit(50)
  // Prefer the audience column; fall back if the migration isn't applied yet.
  let { data, error } = await run('id, type, title, body, link_url, created_at, audience')
  if (error) ({ data, error } = await run('id, type, title, body, link_url, created_at'))
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Push readiness, so the admin can see at a glance whether device
  // notifications will actually go out and to how many devices — rather than
  // sending a broadcast and wondering why no phone buzzed.
  const push = { configured: pushConfigured(), devices: 0, tableReady: false }
  if (push.configured) {
    const { count, error: cErr } = await db
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
    if (!cErr) { push.tableReady = true; push.devices = count || 0 }
  }

  return Response.json({ notifications: data || [], push })
}

export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  const title = (body.title || '').trim()
  const text = (body.body || '').trim()
  if (!title) return Response.json({ error: 'العنوان مطلوب' }, { status: 400 })
  if (!text) return Response.json({ error: 'نص الإشعار مطلوب' }, { status: 400 })
  const type = TYPES.includes(body.type) ? body.type : 'announcement'
  const audience = typeof body.audience === 'string' && body.audience.trim() ? body.audience.trim() : 'all'

  const db = createAdminClient()
  // audience is a newer column; retry without it if the migration isn't applied.
  const base = { user_id: null, type, title, body: text, link_url: body.link_url?.trim() || null }
  let { data, error } = await db.from('notifications').insert({ ...base, audience }).select().single()
  if (error && /audience/i.test(error.message || '')) {
    ({ data, error } = await db.from('notifications').insert(base).select().single())
  }
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Fan out to opted-in devices via Web Push (no-ops if push isn't configured
  // or the subscriptions table is absent). Never fail the broadcast on this.
  let push = null
  try {
    push = await sendPushToAudience({ title, body: text, url: '/', audience })
  } catch { /* push is best-effort */ }

  return Response.json({ ok: true, notification: data, push })
}

export async function DELETE(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  if (!body.id) return Response.json({ error: 'id مطلوب' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('notifications').delete().eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
