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
  : { limit: async () => ({ success: true, remaining: 5, reset: Date.now() + 60_000 }) }

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
  : { limit: async () => ({ success: true, remaining: 50, reset: Date.now() + 86_400_000 }) }

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
