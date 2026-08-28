import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'crypto'

/**
 * Password hashing + a signed session token for the lightweight (no-email)
 * student sign-up. Passwords are hashed with scrypt (salt.hash hex). The
 * session cookie is HMAC-SHA256(studentId) keyed by a server secret so it
 * can't be forged in the browser.
 *
 * Secret: STUDENT_SECRET env var if set, else falls back to the service
 * role key (always present server-side) so it works without extra config.
 */

function secret() {
  return process.env.STUDENT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'seu-hulool-fallback'
}

export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(String(pw), salt, 32).toString('hex')
  return `${salt}.${hash}`
}

export function verifyPassword(pw, stored) {
  if (!stored || !stored.includes('.')) return false
  const [salt, hash] = stored.split('.')
  const test = scryptSync(String(pw), salt, 32)
  const a = Buffer.from(hash, 'hex')
  if (a.length !== test.length) return false
  return timingSafeEqual(a, test)
}

export function signSession(studentId) {
  const sig = createHmac('sha256', secret()).update(String(studentId)).digest('hex')
  return `${studentId}.${sig}`
}

export function verifySession(token) {
  if (!token || !token.includes('.')) return null
  const idx = token.lastIndexOf('.')
  const id = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = createHmac('sha256', secret()).update(String(id)).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return id
}
