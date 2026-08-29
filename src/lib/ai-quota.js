import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { redis, callerKey } from '@/lib/rate-limit'

/**
 * Per-person quota for the PAID AI provider.
 *
 * The site is public, so there is no account to bill against. To still cap
 * paid usage fairly we identify the visitor two ways and enforce the stricter
 * of the two:
 *
 *   1. A signed device id in an httpOnly cookie. httpOnly means page scripts
 *      cannot read or edit it, so clearing localStorage — or changing track /
 *      plan in the app — does nothing to it. It is HMAC-signed, so a forged
 *      or edited cookie fails verification and is replaced.
 *   2. A hash of the caller IP. This is what still applies if someone clears
 *      cookies entirely or opens a private window.
 *
 * Counting against both means evading the cap requires a fresh device *and* a
 * fresh IP, rather than a click in devtools. Exhausting it is not an error:
 * the request simply falls through to the free providers.
 */

const COOKIE = 'seu_dev'
const DAY_MS = 86_400_000
// How many paid-provider replies one person gets per day.
export const PAID_DAILY_LIMIT = Number(process.env.PAID_AI_DAILY_LIMIT || 5)

function secret() {
  return process.env.STUDENT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'seu-hulool-fallback'
}

function sign(id) {
  const sig = createHmac('sha256', secret()).update(String(id)).digest('hex').slice(0, 32)
  return `${id}.${sig}`
}

function verify(token) {
  if (!token || !token.includes('.')) return null
  const idx = token.lastIndexOf('.')
  const id = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = createHmac('sha256', secret()).update(String(id)).digest('hex').slice(0, 32)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return id
}

/**
 * Reads the signed device id from the request, minting a fresh one when it is
 * absent or fails verification. Returns { deviceId, setCookie } — pass
 * setCookie (when present) as a Set-Cookie header on the response.
 */
export function deviceIdentity(request) {
  const raw = request.cookies?.get?.(COOKIE)?.value
    || (request.headers.get('cookie') || '')
      .split(';').map(s => s.trim())
      .find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)

  const existing = verify(raw ? decodeURIComponent(raw) : null)
  if (existing) return { deviceId: existing, setCookie: null }

  const token = sign(randomBytes(12).toString('hex'))
  // 400 days is the longest Chrome will honour; httpOnly keeps scripts out.
  const setCookie = `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax; Secure`
  return { deviceId: token.split('.')[0], setCookie }
}

function ipHash(request) {
  return createHmac('sha256', secret()).update(callerKey(request)).digest('hex').slice(0, 16)
}

// Day bucket so counters reset at midnight UTC without needing expiry sweeps.
const dayStamp = () => Math.floor(Date.now() / DAY_MS)

// Fallback store when Upstash isn't configured. Per-instance, like the
// in-process rate limiter — enough to stop one client looping the paid API.
const mem = new Map()
async function bump(key) {
  const k = `paid:${dayStamp()}:${key}`
  if (redis && typeof redis.incr === 'function') {
    try {
      const n = await redis.incr(k)
      if (n === 1 && typeof redis.expire === 'function') await redis.expire(k, 86_400)
      return n
    } catch { /* fall through to memory */ }
  }
  const n = (mem.get(k) || 0) + 1
  mem.set(k, n)
  if (mem.size > 5000) for (const mk of mem.keys()) if (!mk.startsWith(`paid:${dayStamp()}:`)) mem.delete(mk)
  return n
}

async function peek(key) {
  const k = `paid:${dayStamp()}:${key}`
  if (redis && typeof redis.get === 'function') {
    try { return Number(await redis.get(k)) || 0 } catch { /* fall through */ }
  }
  return mem.get(k) || 0
}

/** Has this visitor already used up today's paid allowance? */
export async function paidQuotaExhausted(request, deviceId) {
  const [byDevice, byIp] = await Promise.all([peek(`d:${deviceId}`), peek(`i:${ipHash(request)}`)])
  return Math.max(byDevice, byIp) >= PAID_DAILY_LIMIT
}

/** Record one paid reply against both identities. Returns remaining count. */
export async function consumePaidQuota(request, deviceId) {
  const [byDevice, byIp] = await Promise.all([bump(`d:${deviceId}`), bump(`i:${ipHash(request)}`)])
  return Math.max(0, PAID_DAILY_LIMIT - Math.max(byDevice, byIp))
}
