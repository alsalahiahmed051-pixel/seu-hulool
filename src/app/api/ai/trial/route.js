import { peekTrial } from '@/lib/ai-trial'
import { deviceIdentity } from '@/lib/ai-quota'
import { BROWSE_TRIAL_AI } from '@/lib/auth-config'

export const runtime = 'nodejs'
// The answer depends on the device cookie and the caller's IP, so it must
// never be cached — a cached "2 left" served to the next visitor would be
// both wrong and someone else's number.
export const dynamic = 'force-dynamic'

/**
 * How much of the browse trial is left, without spending any of it.
 *
 * The trial bar used to render from a localStorage counter, which meant it
 * showed a number the server had never agreed to. This is the server's own
 * count, so the bar and the gate can never disagree.
 */
export async function GET(request) {
  const { deviceId, setCookie } = deviceIdentity(request)
  const trial = await peekTrial(request, deviceId)

  const res = Response.json({
    used: trial.used,
    remaining: trial.remaining,
    limit: BROWSE_TRIAL_AI,
    // False when the database is not configured. The client shows the trial
    // either way; this is here so the state is legible rather than silently
    // pretending an unenforced count is the real one.
    enforced: trial.enforced,
  })
  // Mint the device cookie on this first call, so the very first question is
  // already counted against a stable identity rather than a fresh one.
  if (setCookie) res.headers.append('Set-Cookie', setCookie)
  return res
}
