import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const STATUSES = ['pending', 'approved', 'rejected']

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()
  const { data, error } = await db
    .from('track_requests')
    .select('id, student_name, student_id, current_track, reason, status, admin_reply, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    // Distinguish "not set up yet" from a real failure so the panel can say so.
    return Response.json({ error: error.message, requests: [], tableReady: false }, { status: 200 })
  }
  return Response.json({ requests: data || [], tableReady: true })
}

/** Answer a request: set its status and an optional reply for the student. */
export async function PATCH(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  if (!body.id) return Response.json({ error: 'id مطلوب' }, { status: 400 })
  if (!STATUSES.includes(body.status)) return Response.json({ error: 'حالة غير معروفة' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db
    .from('track_requests')
    .update({
      status: body.status,
      admin_reply: String(body.reply || '').slice(0, 1000) || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  const body = await request.json().catch(() => ({}))
  if (!body.id) return Response.json({ error: 'id مطلوب' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('track_requests').delete().eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
