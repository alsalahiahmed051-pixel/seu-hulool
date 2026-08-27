import { cookies } from 'next/headers'
import { getAdminUser } from '@/lib/supabase/server'
import { isPinConfigured, verifyPinCookie } from '@/lib/admin-pin'

/**
 * Single gate every admin API route calls first. Requires:
 *   1. a logged-in Supabase account whose profile.role is admin/moderator
 *   2. a valid admin_pin cookie — but ONLY if ADMIN_PIN is configured
 *      (so the panel still works before the owner sets a PIN)
 *
 * Returns { ok:true, admin } or { ok:false, status, error }.
 */
export async function requireAdmin() {
  const admin = await getAdminUser()
  if (!admin) {
    return { ok: false, status: 401, error: 'يجب تسجيل الدخول بحساب مسؤول' }
  }
  if (isPinConfigured()) {
    const store = await cookies()
    const cookieVal = store.get('admin_pin')?.value
    if (!verifyPinCookie(admin.user.id, cookieVal)) {
      return { ok: false, status: 403, error: 'رمز الأدمن مطلوب' }
    }
  }
  return { ok: true, admin }
}
