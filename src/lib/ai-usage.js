import { createHmac } from 'crypto'
import { redis } from '@/lib/rate-limit'
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

/**
 * Current usage for a device, without spending anything.
 * Returns { used, remaining, resetAt } where resetAt is when the window rolls.
 */
export async function readUsage(deviceId) {
  const key = `aiuse:${deviceId}`
  const now = Date.now()

  if (redis && typeof redis.get === 'function') {
    try {
      const raw = await redis.get(key)
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (parsed && parsed.resetAt > now) {
        return { used: parsed.count, remaining: Math.max(0, FREE_MESSAGES - parsed.count), resetAt: parsed.resetAt }
      }
      return { used: 0, remaining: FREE_MESSAGES, resetAt: now + COOLDOWN_MS }
    } catch { /* fall through to memory */ }
  }

  const e = mem.get(key)
  if (e && e.resetAt > now) {
    return { used: e.count, remaining: Math.max(0, FREE_MESSAGES - e.count), resetAt: e.resetAt }
  }
  return { used: 0, remaining: FREE_MESSAGES, resetAt: now + COOLDOWN_MS }
}

/** Record one question. Returns the usage *after* it. */
export async function spendMessage(deviceId) {
  const key = `aiuse:${deviceId}`
  const now = Date.now()
  const cur = await readUsage(deviceId)
  // A fresh window starts at the first question of the window, so the hour is
  // measured from when the student started, not from midnight.
  const resetAt = cur.used === 0 ? now + COOLDOWN_MS : cur.resetAt
  const next = { count: cur.used + 1, resetAt }

  if (redis && typeof redis.set === 'function') {
    try {
      await redis.set(key, JSON.stringify(next), { ex: Math.ceil((resetAt - now) / 1000) })
      return { used: next.count, remaining: Math.max(0, FREE_MESSAGES - next.count), resetAt }
    } catch { /* fall through to memory */ }
  }

  mem.set(key, next)
  if (mem.size > 5000) for (const [k, v] of mem) if (v.resetAt <= now) mem.delete(k)
  return { used: next.count, remaining: Math.max(0, FREE_MESSAGES - next.count), resetAt }
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
