import { cookies } from 'next/headers'
import { getAdminUser } from '@/lib/supabase/server'
import { checkPin, signPin, isPinConfigured } from '@/lib/admin-pin'

export const runtime = 'nodejs'

export async function POST(request) {
  const admin = await getAdminUser()
  if (!admin) {
    return Response.json({ error: 'يجب تسجيل الدخول بحساب مسؤول' }, { status: 401 })
  }
  if (!isPinConfigured()) {
    return Response.json({ error: 'لم يتم ضبط رمز الأدمن بعد' }, { status: 503 })
  }

  let body
  try { body = await request.json() } catch { return Response.json({ error: 'طلب غير صحيح' }, { status: 400 }) }

  if (!checkPin(body?.pin)) {
    return Response.json({ error: 'الرمز غير صحيح' }, { status: 401 })
  }

  const store = await cookies()
  store.set('admin_pin', signPin(admin.user.id), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  })
  return Response.json({ ok: true })
}

// Lets the admin lock the panel again from the UI.
export async function DELETE() {
  const store = await cookies()
  store.delete('admin_pin')
  return Response.json({ ok: true })
}
