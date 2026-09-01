import { createHmac } from 'crypto'
import { redis, hasUpstash } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * The student-facing allowance on the assistant.
 *
 * This is separate from ai-quota.js, which caps what the *paid provider*
 * costs us and is invisible to the student. This one is the rule a student
 * actually sees: a handful of questions, then either wait or subscribe.
 *
 * It counts against the same signed device id, so clearing localStorage or
 * editing the profile does nothing to it, and it is enforced on the server —
 * the client is told the numbers only so it can show them.
 */

export const FREE_MESSAGES = Number(process.env.AI_FREE_MESSAGES || 5)
export const COOLDOWN_MS = Number(process.env.AI_COOLDOWN_MINUTES || 60) * 60_000

const mem = new Map() // deviceId -> { count, resetAt }

const shape = (used, resetAt) => ({
  used,
  remaining: Math.max(0, FREE_MESSAGES - used),
  resetAt,
})

/**
 * Where the count is kept, in order of preference.
 *
 * This used to be "redis, else memory", but `redis` is a real Upstash client
 * only when Upstash is configured — otherwise it is an in-process Map wearing
 * the same method names, and `typeof redis.get === 'function'` is true either
 * way. So on Vercel every question landed in whichever instance served it:
 * the first counted, the second hit a different instance and counted as the
 * first again, and reopening the page handed out a fresh five. The rule the
 * student sees was not enforced at all.
 *
 * Supabase is the durable store now, because it is already configured here.
 * Upstash is still preferred when present, and the Map remains only as a
 * last resort for local development.
 */
const useRedis = () => hasUpstash && redis && typeof redis.get === 'function'

function db() {
  try { return createAdminClient() } catch { return null }
}

/**
 * Current usage for a device, without spending anything.
 * Returns { used, remaining, resetAt } where resetAt is when the window rolls.
 */
export async function readUsage(deviceId) {
  const key = `aiuse:${deviceId}`
  const now = Date.now()
  const fresh = shape(0, now + COOLDOWN_MS)
  if (!deviceId) return fresh

  if (useRedis()) {
    try {
      const raw = await redis.get(key)
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (parsed && parsed.resetAt > now) return shape(parsed.count, parsed.resetAt)
      return fresh
    } catch { /* fall through */ }
  }

  const sb = db()
  if (sb) {
    try {
      const { data, error } = await sb
        .from('ai_usage')
        .select('used, reset_at')
        .eq('device_id', deviceId)
        .maybeSingle()
      if (!error) {
        if (!data) return fresh
        const resetAt = new Date(data.reset_at).getTime()
        // An elapsed window is a fresh one; the row is rewritten on the next spend.
        return resetAt > now ? shape(data.used, resetAt) : fresh
      }
    } catch { /* fall through */ }
  }

  const e = mem.get(key)
  if (e && e.resetAt > now) return shape(e.count, e.resetAt)
  return fresh
}

/** Record one question. Returns the usage *after* it. */
export async function spendMessage(deviceId) {
  const key = `aiuse:${deviceId}`
  const now = Date.now()
  if (!deviceId) return shape(1, now + COOLDOWN_MS)

  if (useRedis()) {
    try {
      const cur = await readUsage(deviceId)
      const resetAt = cur.used === 0 ? now + COOLDOWN_MS : cur.resetAt
      const next = { count: cur.used + 1, resetAt }
      await redis.set(key, JSON.stringify(next), { ex: Math.ceil((resetAt - now) / 1000) })
      return shape(next.count, resetAt)
    } catch { /* fall through */ }
  }

  const sb = db()
  if (sb) {
    try {
      // One statement, server-side: read-then-write from here would let two
      // questions sent at once both read the same count and both write
      // count + 1, handing out a free question per race.
      const { data, error } = await sb.rpc('spend_ai_message', {
        p_device_id: deviceId,
        p_window_secs: Math.round(COOLDOWN_MS / 1000),
      })
      const row = Array.isArray(data) ? data[0] : data
      if (!error && row) return shape(row.used, new Date(row.reset_at).getTime())
    } catch { /* fall through */ }
  }

  // Last resort. Per-instance, so it under-counts on serverless — but the
  // alternative is refusing to answer at all, and the paid-provider cap in
  // ai-quota.js is a separate, independent guard on what this can cost.
  const cur = await readUsage(deviceId)
  const resetAt = cur.used === 0 ? now + COOLDOWN_MS : cur.resetAt
  const next = { count: cur.used + 1, resetAt }
  mem.set(key, next)
  if (mem.size > 5000) for (const [k, v] of mem) if (v.resetAt <= now) mem.delete(k)
  return shape(next.count, resetAt)
}

/**
 * Is this device on an approved, unexpired subscription?
 *
 * Answered from the database rather than anything the client sends, so a
 * student cannot grant themselves one. A missing table (migration not run) or
 * an unreachable database means "not subscribed" — the free allowance still
 * works, which is the safe direction to fail.
 */
export async function isSubscribed(deviceId) {
  if (!deviceId) return false
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('ai_subscriptions')
      .select('expires_at')
      .eq('device_id', deviceId)
      .eq('status', 'approved')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data?.expires_at) return false
    return new Date(data.expires_at).getTime() > Date.now()
  } catch {
    return false
  }
}

/** Stable, non-reversible tag for an email, for counting without storing it. */
export function emailTag(email) {
  return createHmac('sha256', process.env.STUDENT_SECRET || 'seu-hulool-fallback')
    .update(String(email || '').trim().toLowerCase())
    .digest('hex')
    .slice(0, 16)
}

/** A permissive but real check — enough to catch typos, not to verify. */
export function looksLikeEmail(v) {
  const s = String(v || '').trim()
  return s.length >= 6 && s.length <= 160 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s)
}
