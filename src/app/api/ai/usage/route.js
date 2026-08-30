import { deviceIdentity } from '@/lib/ai-quota'
import { readUsage, isSubscribed, FREE_MESSAGES, COOLDOWN_MS } from '@/lib/ai-usage'

export const runtime = 'nodejs'

/**
 * What the assistant will let this visitor do right now.
 *
 * The client needs the numbers to show "٣ من ٥ أسئلة" and the countdown, but
 * it is never trusted with them — /api/ai enforces the same values again on
 * every question. `deviceId` is returned so a subscription request can name
 * the device it is for; the cookie itself stays httpOnly.
 */
export async function GET(request) {
  const { deviceId, setCookie } = deviceIdentity(request)
  const subscribed = await isSubscribed(deviceId)
  const usage = subscribed
    ? { used: 0, remaining: FREE_MESSAGES, resetAt: Date.now() }
    : await readUsage(deviceId)

  const res = Response.json({
    deviceId,
    subscribed,
    limit: FREE_MESSAGES,
    cooldownMs: COOLDOWN_MS,
    ...usage,
  })
  if (setCookie) res.headers.append('Set-Cookie', setCookie)
  return res
}
