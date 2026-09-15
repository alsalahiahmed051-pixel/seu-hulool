/**
 * How long a student is made to wait before the next provider is tried.
 *
 * ── The bug ─────────────────────────────────────────────────────────────
 * The routes tried providers in turn and awaited each one with no clock on
 * it. A provider that is DOWN answers quickly — it refuses, and the loop
 * moves on. A provider that is merely overloaded does the damage: it holds
 * the connection open, and the loop holds with it, until the platform kills
 * the whole function at sixty seconds and the student gets nothing at all.
 *
 * That is «التأخير بالرد مرة سيئ» exactly: not a slow answer, a slow silence
 * ending in an apology. Ordering providers by quality only decides who gets
 * to hang first.
 *
 * ── The clock ───────────────────────────────────────────────────────────
 * Each attempt gets a share of one overall budget. The first provider gets
 * the largest share, because it is the one expected to answer; whoever is
 * left splits what remains, never less than a floor worth trying. When the
 * budget is gone the loop stops and apologises while there is still time to
 * send the apology — a reply at thirty seconds beats a timeout at sixty.
 *
 * The losing request is abandoned, not cancelled: `Promise.race` stops the
 * WAIT, and the provider's own fetch is left to finish into nothing. Passing
 * an abort signal down through four provider functions would cancel it
 * properly, but nothing the student sees would change, and the function ends
 * with the response either way.
 */

/** The whole request's budget, inside a 60s platform limit. */
export const TOTAL_BUDGET_MS = 42000
/** Never give a provider less than this — below it, nothing could answer. */
export const MIN_ATTEMPT_MS = 7000
/** The first provider is the one expected to answer, so it gets the most. */
export const FIRST_ATTEMPT_MS = 20000

/** Thrown when an attempt runs out of clock, so the loop can name the reason. */
export class DeadlineError extends Error {
  constructor(ms) {
    super(`timed out after ${ms}ms`)
    this.name = 'DeadlineError'
  }
}

/**
 * Resolve `promise`, or reject with DeadlineError once `ms` has passed.
 *
 * The timer is always cleared, including on the happy path: a pending timer
 * keeps a serverless function alive after its response has been sent.
 */
export function withDeadline(promise, ms) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new DeadlineError(ms)), ms)
    }),
  ])
}

/**
 * A clock shared across one request's attempts.
 *
 * @param {number} total the whole budget in ms
 * @param {number} [now] injectable for tests
 */
export function budget(total = TOTAL_BUDGET_MS, now = Date.now()) {
  const startedAt = now
  let attempts = 0
  return {
    /** Milliseconds still available, never negative. */
    left: (at = Date.now()) => Math.max(0, total - (at - startedAt)),
    /** Whether another attempt could still say anything useful. */
    canTry: (at = Date.now()) => total - (at - startedAt) >= MIN_ATTEMPT_MS,
    /**
     * The slice for the next attempt.
     *
     * The first gets `FIRST_ATTEMPT_MS`; the rest split what is left so that
     * a late provider is not handed a budget it cannot use — but never below
     * the floor, and never more than remains.
     */
    next: (remainingProviders = 1, at = Date.now()) => {
      const left = Math.max(0, total - (at - startedAt))
      const want = attempts === 0
        ? FIRST_ATTEMPT_MS
        : Math.floor(left / Math.max(1, remainingProviders))
      attempts++
      return Math.max(MIN_ATTEMPT_MS, Math.min(left, want))
    },
  }
}
