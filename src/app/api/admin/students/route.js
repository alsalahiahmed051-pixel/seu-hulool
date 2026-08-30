import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * The students actually using the site.
 *
 * This used to read `students`, a leftover of the account system that was
 * removed — rows there are frozen sign-ups from a login flow that no longer
 * exists, so the tab showed a list nobody was adding to. It now reads
 * `student_identities`, which the profile writes on every save, so the tab
 * reflects who is really here: name, university ID, email and track, keyed on
 * the signed device cookie.
 */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()
  const { data, error } = await db
    .from('student_identities')
    .select('device_id, full_name, student_id, email, track, college, plan, confirmed_at, first_seen, last_seen')
    .order('last_seen', { ascending: false })
    .limit(500)
  if (error) {
    // Distinguish "migration not run yet" from a real failure.
    return Response.json({ error: error.message, students: [], tableReady: false }, { status: 200 })
  }
  return Response.json({ students: data || [], tableReady: true })
}

export async function DELETE(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  const body = await request.json().catch(() => ({}))
  if (!body.id) return Response.json({ error: 'معرّف غير صحيح' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('student_identities').delete().eq('device_id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
