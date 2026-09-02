import { deviceIdentity } from '@/lib/ai-quota'
import { readUsage, isSubscribed, COOLDOWN_MS, readPointsConfig } from '@/lib/ai-usage'
import { ownerKey } from '@/lib/ai-points'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * What the assistant will let this visitor do right now.
 *
 * The client needs the numbers to show the balance and the countdown, but it
 * is never trusted with them — /api/ai enforces the same values again on every
 * question. `deviceId` is returned so a subscription request can name the
 * device it is for; the cookie itself stays httpOnly.
 *
 * The costs travel with the balance so the interface can say what a thing will
 * cost *before* it is spent. A student who only learns the price after paying
 * it has not been given a choice.
 */
export async function GET(request) {
  const { deviceId, setCookie } = deviceIdentity(request)

  // Same key as /api/ai, or the number shown here would describe a different
  // balance from the one actually charged.
  let userId = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id || null
  } catch { /* no session — the device key stands in */ }

  const points = await readPointsConfig()
  const owner = ownerKey({ userId, deviceId })
  const subscribed = await isSubscribed(deviceId)
  const usage = subscribed
    ? { used: 0, remaining: points.free, resetAt: Date.now(), free: points.free }
    : await readUsage(owner, points.free)

  const res = Response.json({
    deviceId,
    subscribed,
    limit: points.free,
    cooldownMs: COOLDOWN_MS,
    costs: { message: points.message, image: points.image, quiz: points.quiz },
    // True once the balance follows the account rather than this browser.
    perAccount: Boolean(userId),
    ...usage,
  })
  if (setCookie) res.headers.append('Set-Cookie', setCookie)
  return res
}
