import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ROLES = ['student', 'moderator', 'admin']

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()

  const { data: profiles, error } = await db
    .from('profiles')
    .select('id, full_name, username, role, total_sessions, total_minutes, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Emails live in auth.users — pull them and merge by id.
  const emailById = {}
  try {
    const { data: authData } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of authData?.users || []) emailById[u.id] = u.email
  } catch { /* if this fails we just omit emails */ }

  const users = (profiles || []).map(p => ({ ...p, email: emailById[p.id] || null }))
  return Response.json({ users })
}

export async function PATCH(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  if (!body.id || !ROLES.includes(body.role)) {
    return Response.json({ error: 'بيانات غير صحيحة' }, { status: 400 })
  }

  // Guard: an admin can't strip their own admin role (avoids locking
  // yourself out of the only admin account by accident).
  if (body.id === gate.admin.user.id && body.role !== 'admin') {
    return Response.json({ error: 'لا يمكنك إزالة صلاحية الأدمن عن حسابك أنت' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('profiles')
    .update({ role: body.role })
    .eq('id', body.id)
    .select('id, full_name, role')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, user: data })
}
