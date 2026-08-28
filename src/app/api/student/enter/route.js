import { createAdminClient } from '@/lib/supabase/server'
import { hashPassword, verifyPassword, signSession } from '@/lib/student-auth'

export const runtime = 'nodejs'

const COOKIE = 'seu_student'

// One button for everything: if the name already exists, verify the password
// (log in); otherwise create the account (register). Keeps the UX to a single
// simple form.
export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const full_name = String(body.full_name || '').trim()
  const track = String(body.track || '').trim()
  const plan = String(body.plan || '').trim()
  const password = String(body.password || '')

  if (full_name.length < 2) return Response.json({ error: 'اكتب اسمك' }, { status: 400 })
  if (password.length < 4) return Response.json({ error: 'كلمة المرور 4 أحرف على الأقل' }, { status: 400 })

  const db = createAdminClient()
  const { data: existing, error: findErr } = await db
    .from('students')
    .select('id, full_name, track, plan, pass_hash')
    .ilike('full_name', full_name)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (findErr) return Response.json({ error: findErr.message }, { status: 500 })

  let student, mode
  if (existing) {
    if (!verifyPassword(password, existing.pass_hash)) {
      return Response.json({ error: 'الاسم مستخدم وكلمة المرور غير صحيحة' }, { status: 401 })
    }
    // Refresh track/plan if the user re-selected them, and stamp last_login.
    const patch = { last_login: new Date().toISOString() }
    if (track) patch.track = track
    if (plan) patch.plan = plan
    const { data } = await db.from('students').update(patch).eq('id', existing.id)
      .select('id, full_name, track, plan').single()
    student = data || { id: existing.id, full_name: existing.full_name, track: existing.track, plan: existing.plan }
    mode = 'login'
  } else {
    const { data, error } = await db.from('students')
      .insert({ full_name, track: track || null, plan: plan || null, pass_hash: hashPassword(password) })
      .select('id, full_name, track, plan').single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    student = data
    mode = 'register'
  }

  const res = Response.json({ ok: true, mode, student })
  res.headers.append('Set-Cookie', `${COOKIE}=${signSession(student.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`)
  return res
}
