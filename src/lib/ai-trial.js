import { createAdminClient } from '@/lib/supabase/server'
import { deviceIdentity, ipHash } from '@/lib/ai-quota'
import { BROWSE_TRIAL_AI } from '@/lib/auth-config'

/**
 * The assistant's browse trial, enforced on the server.
 *
 * It used to be a number in localStorage. Clearing site data — or a private
 * window — handed out a fresh trial, so it was a suggestion rather than a
 * trial. The count now lives in `ai_trials`, keyed by two things the page
 * cannot edit:
 *
 *   • the signed HttpOnly device cookie (`deviceIdentity`), and
 *   • an HMAC of the caller's IP (`ipHash`) — the raw address is never stored.
 *
 * ── Why the IP is a ceiling and not the trial ────────────────────────────
 *
 * A campus network, or a mobile carrier behind CGNAT, puts thousands of
 * students on one address. A strict three-per-IP trial would tell the second
 * student on that network that they had spent a trial they never saw — a much
 * worse failure than the one it prevents. So:
 *
 *   • the DEVICE gets the real trial: BROWSE_TRIAL_AI questions, permanently;
 *   • the IP gets a DAILY ceiling, high enough that a genuine student behind a
 *     shared address is never the one who hits it, low enough that a single
 *     person cannot farm the trial by cycling devices and private windows.
 *
 * Both are checked; the stricter one wins. Same discipline as the paid quota.
 */

/** The daily per-IP ceiling on trial questions. */
export const TRIAL_IP_DAILY = Number(process.env.BROWSE_TRIAL_IP_DAILY || 40)

const DAY_MS = 86_400_000
const dayStamp = () => Math.floor(Date.now() / DAY_MS)

/**
 * The identities this request is counted against, and what each may spend.
 * The device comes first: its numbers are the ones the student is shown.
 */
function keysFor(request, deviceId) {
  return {
    keys: [`d:${deviceId}`, `i:${ipHash(request)}:${dayStamp()}`],
    limits: [BROWSE_TRIAL_AI, TRIAL_IP_DAILY],
  }
}

function db() {
  try { return createAdminClient() } catch { return null }
}

/**
 * Read the trial without spending it.
 *
 * Returns `{ ok, used, remaining, enforced }`. `enforced` is false when the
 * database is not configured — the caller can then say so rather than quietly
 * presenting an unenforced number as if it were the real one.
 */
export async function peekTrial(request, deviceId) {
  const client = db()
  if (!client) return { ok: true, used: 0, remaining: BROWSE_TRIAL_AI, enforced: false }
  const { keys, limits } = keysFor(request, deviceId)
  const { data, error } = await client.rpc('peek_ai_trial', { p_keys: keys, p_limits: limits })
  if (error) return { ok: true, used: 0, remaining: BROWSE_TRIAL_AI, enforced: false }
  const row = Array.isArray(data) ? data[0] : data
  return {
    ok: !!row?.allowed,
    used: Number(row?.used) || 0,
    remaining: Number(row?.remaining) || 0,
    enforced: true,
  }
}

/**
 * Spend one trial question.
 *
 * Returns the same shape as peekTrial. A database that cannot answer must not
 * become a free pass, but it must not lock out every visitor either — so an
 * error is reported as `{ error: true }` and the caller refuses this one
 * request rather than silently allowing or silently banning. Same rule the
 * quiz trial follows.
 */
export async function claimTrial(request, deviceId) {
  const client = db()
  // No database configured at all (local dev, a fresh deploy): the trial is
  // not enforceable, and pretending otherwise would block the assistant
  // entirely. Say so and let the caller through.
  if (!client) return { ok: true, used: 0, remaining: BROWSE_TRIAL_AI, enforced: false }

  const { keys, limits } = keysFor(request, deviceId)
  const { data, error } = await client.rpc('claim_ai_trial', { p_keys: keys, p_limits: limits })
  if (error) return { ok: false, used: 0, remaining: 0, enforced: true, error: true }

  const row = Array.isArray(data) ? data[0] : data
  return {
    ok: !!row?.allowed,
    used: Number(row?.used) || 0,
    remaining: Number(row?.remaining) || 0,
    enforced: true,
  }
}

export { deviceIdentity }
