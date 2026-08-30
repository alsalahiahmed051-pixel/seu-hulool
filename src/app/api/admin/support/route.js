import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const STATUSES = ['new', 'read', 'answered']

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()
  const { data, error } = await db
    .from('support_messages')
    .select('id, student_name, student_id, email, topic, message, page, status, admin_reply, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    return Response.json({ error: error.message, messages: [], tableReady: false }, { status: 200 })
  }
  return Response.json({ messages: data || [], tableReady: true })
}

export async function PATCH(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  if (!body.id) return Response.json({ error: 'id مطلوب' }, { status: 400 })
  if (!STATUSES.includes(body.status)) return Response.json({ error: 'حالة غير معروفة' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('support_messages').update({
    status: body.status,
    admin_reply: String(body.reply || '').slice(0, 2000) || null,
    updated_at: new Date().toISOString(),
  }).eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  const body = await request.json().catch(() => ({}))
  if (!body.id) return Response.json({ error: 'id مطلوب' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('support_messages').delete().eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
