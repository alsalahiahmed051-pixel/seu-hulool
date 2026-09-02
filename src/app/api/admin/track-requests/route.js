import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'
import { openSystemThread } from '@/lib/messages'

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

  const reply = String(body.reply || '').slice(0, 1000) || null

  const db = createAdminClient()
  const { data: row, error } = await db
    .from('track_requests')
    .update({
      status: body.status,
      admin_reply: reply,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .select('device_id, student_name, current_track')
    .maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // The profile page already shows this answer, but only to someone who
  // thinks to go back and look at it. Putting it in the inbox means the badge
  // does the remembering, and 'pending' is included on purpose: a reply that
  // asks the student a question is the case the owner wanted most, and it is
  // worthless if it waits for them to wander past it.
  if (row?.device_id && (reply || body.status !== 'pending')) {
    const head = body.status === 'approved'
      ? 'وافقت الإدارة على تغيير مسارك — يمكنك اختيار مسارك الجديد من «حسابي».'
      : body.status === 'rejected'
        ? 'لم يُقبل طلب تغيير المسار.'
        : 'بخصوص طلبك لتغيير المسار:'
    const rest = reply ? `\n\n${reply}` : ''
    await openSystemThread({
      deviceId: row.device_id,
      name: row.student_name,
      kind: 'track',
      subject: 'طلب تغيير المسار',
      body: head + rest + '\n\nتستطيع الرد على هذه الرسالة.',
    })
  }

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
