import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Second-factor admin PIN, layered ON TOP of the real Supabase admin
 * account check (getAdminUser). The PIN itself lives only in the
 * ADMIN_PIN env var (server-side) — it is never sent to the browser and
 * never stored in the DB.
 *
 * After a correct PIN is entered we set an httpOnly cookie whose value
 * is HMAC-SHA256(userId, ADMIN_PIN). That value can't be forged without
 * knowing ADMIN_PIN (a server secret), and it's bound to the specific
 * user id — so a stolen cookie from one account is useless on another.
 */

export function isPinConfigured() {
  return !!process.env.ADMIN_PIN && process.env.ADMIN_PIN.length >= 4
}

/** The cookie value we expect for a given user when the PIN is valid. */
export function signPin(userId) {
  const secret = process.env.ADMIN_PIN || ''
  return createHmac('sha256', secret).update(String(userId)).digest('hex')
}

/** Constant-time check that a submitted PIN matches ADMIN_PIN. */
export function checkPin(provided) {
  const expected = process.env.ADMIN_PIN
  if (!provided || !expected) return false
  const a = Buffer.from(String(provided))
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Constant-time check that the admin_pin cookie is valid for this user. */
export function verifyPinCookie(userId, cookieVal) {
  if (!cookieVal || !isPinConfigured()) return false
  const expected = signPin(userId)
  const a = Buffer.from(cookieVal)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
