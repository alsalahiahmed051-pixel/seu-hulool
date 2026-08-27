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

  const db = createAdminClient()
  const { data, error } = await db.from('notifications').insert({
    user_id: null, // broadcast to all students
    type,
    title,
    body: text,
    link_url: body.link_url?.trim() || null,
  }).select().single()
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
