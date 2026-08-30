import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const STATUSES = ['pending', 'approved', 'rejected']
const DAY_MS = 86_400_000

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()
  const { data, error } = await db
    .from('ai_subscriptions')
    .select('id, device_id, student_name, student_id, email, note, receipt_url, status, admin_reply, expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    // Distinguish "not set up yet" from a real failure so the panel can say so.
    return Response.json({ error: error.message, requests: [], tableReady: false }, { status: 200 })
  }
  return Response.json({ requests: data || [], tableReady: true })
}

/**
 * Answer a request. Approving sets the expiry that the assistant checks —
 * `days` (default 30) from now — so access ends on its own rather than
 * needing to be revoked by hand.
 */
export async function PATCH(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  if (!body.id) return Response.json({ error: 'id مطلوب' }, { status: 400 })
  if (!STATUSES.includes(body.status)) return Response.json({ error: 'حالة غير معروفة' }, { status: 400 })

  const days = Math.min(365, Math.max(1, Number(body.days) || 30))
  const patch = {
    status: body.status,
    admin_reply: String(body.reply || '').slice(0, 1000) || null,
    updated_at: new Date().toISOString(),
  }
  // Only an approval carries an expiry; rejecting clears any old one so a
  // previously-approved device loses access immediately.
  patch.expires_at = body.status === 'approved' ? new Date(Date.now() + days * DAY_MS).toISOString() : null

  const db = createAdminClient()
  const { error } = await db.from('ai_subscriptions').update(patch).eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, expires_at: patch.expires_at })
}

export async function DELETE(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  const body = await request.json().catch(() => ({}))
  if (!body.id) return Response.json({ error: 'id مطلوب' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('ai_subscriptions').delete().eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
