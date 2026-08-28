import { createAdminClient } from '@/lib/supabase/server'
import { verifyPassword, signSession } from '@/lib/student-auth'

export const runtime = 'nodejs'

const COOKIE = 'seu_student'

// Restore a student's profile on a new device via full name + password.
export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const full_name = String(body.full_name || '').trim()
  const password = String(body.password || '')
  if (!full_name || !password) return Response.json({ error: 'أدخل الاسم وكلمة المرور' }, { status: 400 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('students')
    .select('id, full_name, track, plan, pass_hash')
    .ilike('full_name', full_name)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data || !verifyPassword(password, data.pass_hash)) {
    return Response.json({ error: 'الاسم أو كلمة المرور غير صحيحة' }, { status: 401 })
  }

  await db.from('students').update({ last_login: new Date().toISOString() }).eq('id', data.id)

  const res = Response.json({ ok: true, student: { id: data.id, full_name: data.full_name, track: data.track, plan: data.plan } })
  res.headers.append('Set-Cookie', `${COOKIE}=${signSession(data.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`)
  return res
}
