import { createAdminClient } from '@/lib/supabase/server'
import { hashPassword, signSession } from '@/lib/student-auth'

export const runtime = 'nodejs'

const COOKIE = 'seu_student'

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const full_name = String(body.full_name || '').trim()
  const track = String(body.track || '').trim()
  const plan = String(body.plan || '').trim()
  const password = String(body.password || '')

  if (full_name.length < 2) return Response.json({ error: 'اكتب اسمك كاملاً' }, { status: 400 })
  if (password.length < 4) return Response.json({ error: 'كلمة المرور 4 أحرف على الأقل' }, { status: 400 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('students')
    .insert({ full_name, track: track || null, plan: plan || null, pass_hash: hashPassword(password) })
    .select('id, full_name, track, plan')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const res = Response.json({ ok: true, student: data })
  res.headers.append('Set-Cookie', `${COOKIE}=${signSession(data.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`)
  return res
}
