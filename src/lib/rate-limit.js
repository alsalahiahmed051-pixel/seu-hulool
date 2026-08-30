import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// In-memory fallback for local dev (when Upstash not configured)
class MemoryStore {
  constructor() { this.store = new Map() }
  async get(key) {
    const item = this.store.get(key)
    if (!item) return null
    if (item.expires && item.expires < Date.now()) {
      this.store.delete(key)
      return null
    }
    return item.value
  }
  async set(key, value, opts = {}) {
    const expires = opts.ex ? Date.now() + opts.ex * 1000 : null
    this.store.set(key, { value, expires })
    return 'OK'
  }
  async incr(key) {
    const cur = (await this.get(key)) || 0
    const next = Number(cur) + 1
    const existing = this.store.get(key)
    this.store.set(key, { value: next, expires: existing?.expires })
    return next
  }
  async expire(key, seconds) {
    const item = this.store.get(key)
    if (item) item.expires = Date.now() + seconds * 1000
    return 1
  }
  async eval() { return [1, Date.now() + 60000] } // graceful no-op
}

const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

/**
 * Real in-process limiter used when Upstash isn't configured.
 *
 * The AI endpoints are open to anonymous visitors (the site is public), so a
 * permissive stub would leave paid providers unprotected. This enforces a
 * genuine per-key budget within the running instance. It is per-instance, so
 * a serverless fleet multiplies the effective ceiling — configure Upstash for
 * a strict global limit — but it still stops the runaway single-client abuse
 * that matters most.
 */
function memoryLimiter(max, windowMs, prefix) {
  const hits = new Map() // key -> { count, reset }
  return {
    async limit(key) {
      const k = `${prefix}:${key}`
      const now = Date.now()
      let e = hits.get(k)
      if (!e || e.reset <= now) { e = { count: 0, reset: now + windowMs }; hits.set(k, e) }
      e.count++
      // Opportunistic cleanup so the map can't grow without bound.
      if (hits.size > 5000) for (const [hk, hv] of hits) if (hv.reset <= now) hits.delete(hk)
      return { success: e.count <= max, remaining: Math.max(0, max - e.count), reset: e.reset }
    },
    // Read the budget without spending one. Used by diagnostics that explain a
    // refusal — asking "why was I blocked?" must not itself block you.
    async peek(key) {
      const e = hits.get(`${prefix}:${key}`)
      if (!e || e.reset <= Date.now()) return max
      return Math.max(0, max - e.count)
    },
  }
}

/**
 * How many requests `key` has left, without consuming one.
 * Works for both the Upstash limiter and the in-process fallback.
 */
export async function remainingFor(limiter, key) {
  try {
    if (typeof limiter.peek === 'function') return await limiter.peek(key)
    if (typeof limiter.getRemaining === 'function') {
      const r = await limiter.getRemaining(key)
      return typeof r === 'number' ? r : (r?.remaining ?? 1)
    }
  } catch { /* a diagnostic must never be the thing that fails */ }
  return 1
}

export const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : new MemoryStore()

// 5 chat requests per minute per user
export const chatPerMinuteLimit = hasUpstash
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        Number(process.env.CHAT_PER_MINUTE_LIMIT || 5),
        '1 m'
      ),
      prefix: 'rl:chat:minute',
    })
  : memoryLimiter(Number(process.env.CHAT_PER_MINUTE_LIMIT || 5), 60_000, 'chat:min')

// 50 chat requests per day per user
export const chatDailyLimit = hasUpstash
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(
        Number(process.env.CHAT_DAILY_LIMIT || 50),
        '1 d'
      ),
      prefix: 'rl:chat:day',
    })
  : memoryLimiter(Number(process.env.CHAT_DAILY_LIMIT || 50), 86_400_000, 'chat:day')

// GlobalAI overlay (/api/ai, /api/ai-quiz) — separate, slightly looser
// budget from the per-subject chat above since it also powers quiz mode.
export const aiPerMinuteLimit = hasUpstash
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        Number(process.env.AI_PER_MINUTE_LIMIT || 10),
        '1 m'
      ),
      prefix: 'rl:ai:minute',
    })
  : memoryLimiter(Number(process.env.AI_PER_MINUTE_LIMIT || 10), 60_000, 'ai:min')

export const aiDailyLimit = hasUpstash
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(
        Number(process.env.AI_DAILY_LIMIT || 80),
        '1 d'
      ),
      prefix: 'rl:ai:day',
    })
  : memoryLimiter(Number(process.env.AI_DAILY_LIMIT || 80), 86_400_000, 'ai:day')

// Track-change requests write rows an admin reads; a few per hour is plenty
// and stops one client filling the queue.
export const trackRequestLimit = hasUpstash
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(Number(process.env.TRACK_REQUEST_HOURLY_LIMIT || 3), '1 h'),
      prefix: 'rl:trackreq',
    })
  : memoryLimiter(Number(process.env.TRACK_REQUEST_HOURLY_LIMIT || 3), 3_600_000, 'trackreq')

// Receipt uploads get their own budget rather than sharing the track-change
// one. Three per hour, shared with track requests and support messages across
// everyone behind a campus or carrier NAT, meant a student could be refused a
// receipt upload for an hour without having done anything — and the Blob SDK
// reports that as an unexplained failure. A dozen an hour still bounds abuse:
// nothing is stored until the request itself is sent.
export const receiptUploadLimit = hasUpstash
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(Number(process.env.RECEIPT_UPLOAD_HOURLY_LIMIT || 12), '1 h'),
      prefix: 'rl:receipt',
    })
  : memoryLimiter(Number(process.env.RECEIPT_UPLOAD_HOURLY_LIMIT || 12), 3_600_000, 'receipt')

// File downloads are open to every visitor (no accounts), so cap how fast one
// client can pull PDFs through the proxy.
export const downloadPerMinuteLimit = hasUpstash
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(Number(process.env.DOWNLOAD_PER_MINUTE_LIMIT || 30), '1 m'),
      prefix: 'rl:dl:minute',
    })
  : memoryLimiter(Number(process.env.DOWNLOAD_PER_MINUTE_LIMIT || 30), 60_000, 'dl:min')

/**
 * Identity used for rate limiting on the public AI endpoints.
 *
 * The site requires no account, so limit by client IP (from the proxy headers
 * Vercel sets). Falls back to a shared bucket when no IP is available, which
 * errs on the side of limiting rather than letting requests through unbounded.
 */
export function callerKey(request) {
  const fwd = request.headers.get('x-forwarded-for') || ''
  const ip = fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || ''
  return ip || 'anon'
}

/**
 * Hash an IP address for storing in DB (don't store raw IPs — PDPL compliance)
 */
export async function hashIP(ip) {
  if (!ip) return null
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(ip + (process.env.ANTHROPIC_API_KEY || 'salt'))
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16)
  }
  return null
}
