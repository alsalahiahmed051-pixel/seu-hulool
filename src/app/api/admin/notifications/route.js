import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const TYPES = ['info', 'announcement', 'warning', 'success']

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()
  // Broadcasts only (user_id IS NULL) — the ones an admin sends to everyone.
  const { data, error } = await db
    .from('notifications')
    .select('id, type, title, body, link_url, created_at')
    .is('user_id', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ notifications: data || [] })
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
  return Response.json({ ok: true, notification: data })
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
