/**
 * Not asking a provider that just told us no.
 *
 * ── Where the remaining delay comes from ────────────────────────────────
 *
 * Gemini answers first because its Arabic is the best. When its free quota
 * runs out it refuses — quickly, but not for free: a DNS lookup, a TLS
 * handshake and a round trip to Google, on every single question, to be told
 * the same thing it said a second ago. Then the real provider is asked, and
 * only then does the student's answer start being written.
 *
 * On a warm function that wasted trip is a second. On a cold one — which on
 * this plan is most of them — it is several. It is pure loss: nothing about
 * the request changes the answer, which was already decided at the provider.
 *
 * So a refusal that will still be a refusal in a minute is remembered, and the
 * provider is skipped while it lasts. The next question goes straight to
 * whoever can actually answer it.
 *
 * ── Deliberately short, and deliberately per-instance ───────────────────
 *
 * This lives in module memory, so each serverless instance learns on its own
 * and forgets on redeploy. That is the right shape for it: a shared store
 * would need a network call to avoid a network call, and a cooldown that
 * outlives the process could hide a quota that has already renewed. The
 * windows below are short enough that a recovered provider is tried again
 * soon, and long enough to spare a burst of questions the same dead round
 * trip.
 */

/** How long each kind of refusal is believed, in ms. */
const COOLDOWN = {
  // A per-minute limit clears in a minute; a daily one does not. Two minutes
  // splits the difference: a minute-limited key comes back almost at once,
  // and a day-limited one is skipped for the next burst rather than the day.
  quota: 2 * 60 * 1000,
  // A rejected key does not fix itself, but changing it means a redeploy,
  // which restarts the process and clears this anyway.
  badKey: 10 * 60 * 1000,
}

/** name -> timestamp when it may be tried again. */
const until = new Map()

/** Whether this provider is worth a round trip right now. */
export function isUsable(name, now = Date.now()) {
  const t = until.get(name)
  if (!t) return true
  if (now >= t) { until.delete(name); return true }
  return false
}

/** Seconds left on a cooldown, for a message that says when to come back. */
export function cooldownLeft(name, now = Date.now()) {
  const t = until.get(name)
  return t && t > now ? Math.ceil((t - now) / 1000) : 0
}

/**
 * Record what a provider said, and decide whether to stop asking.
 *
 * Only the two refusals that are ABOUT THE CALLER rather than the request are
 * remembered. A timeout, a 5xx or a bad model name are all things the very
 * next request might not hit, so they never silence a provider — that would
 * turn one unlucky second into minutes of a degraded assistant.
 *
 * @returns {string} the cooldown kind applied, or '' when none
 */
export function noteFailure(name, message, now = Date.now()) {
  const s = String(message || '')
  let kind = ''
  if (/\b429\b|quota|rate.?limit|exhaust|too many requests|insufficient_quota/i.test(s)) kind = 'quota'
  else if (/\b40[13]\b|api key not valid|invalid api key|unauthor|forbidden|permission denied/i.test(s)) kind = 'badKey'
  if (!kind) return ''
  until.set(name, now + COOLDOWN[kind])
  return kind
}

/** A provider that answered is healthy again, whatever it said before. */
export function noteSuccess(name) {
  until.delete(name)
}

/** For tests, and for a self-test that must measure the real thing. */
export function resetProviderHealth() {
  until.clear()
}

/** What is currently on cooldown, for the admin self-test. */
export function cooldowns(now = Date.now()) {
  const out = {}
  for (const [name, t] of until.entries()) {
    if (t > now) out[name] = Math.ceil((t - now) / 1000)
  }
  return out
}
