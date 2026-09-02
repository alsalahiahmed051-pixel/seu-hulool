/**
 * What the assistant costs, and who is paying.
 *
 * The allowance used to be "five messages". That could not tell an ordinary
 * question apart from one carrying an image, or from generating a whole quiz —
 * so the cheapest and the most expensive thing the assistant does drew down
 * the same single unit. Points let one balance price several actions.
 *
 * The prices live in site_content, not in this file. The owner asked for the
 * numbers to be theirs to change, and a price that needs a deploy to adjust is
 * a price nobody adjusts.
 */

/** Used when the owner has not set anything yet. */
// A quiz is deliberately absent. The owner's rule for quizzes is one free
// trial per person and then a subscription — not a points cost — so a quiz
// price would be a dial in the admin panel that changes nothing. See
// quiz_trials and claim_quiz_trial.
export const DEFAULT_POINTS = {
  free: 20,     // the balance a student starts each window with
  message: 1,   // an ordinary question
  image: 2,     // a question carrying an image — more to read, more to answer
}

/** How wide the window is before the balance refills. */
export const WINDOW_MS = Number(process.env.AI_COOLDOWN_MINUTES || 60) * 60_000

const clampInt = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= lo && n <= hi ? n : fallback
}

/**
 * The owner's prices, made safe to use.
 *
 * Every value is clamped rather than trusted, because this row is editable
 * from the admin panel and a free balance of NaN or a negative message cost
 * would not fail loudly — it would quietly hand out an unlimited assistant.
 * Kept pure and separate from the read that fetches it: this is the part that
 * has to be right, and it can be checked without a database.
 */
export function sanitisePoints(raw) {
  const d = raw || {}
  return {
    free: clampInt(d.free, 0, 10_000, DEFAULT_POINTS.free),
    message: clampInt(d.message, 0, 1000, DEFAULT_POINTS.message),
    image: clampInt(d.image, 0, 1000, DEFAULT_POINTS.image),
  }
}

/**
 * Who the balance belongs to.
 *
 * An account wins whenever there is one, which is the point: the owner's
 * complaint was that the allowance followed the phone rather than the person,
 * so the same student on a second device started over. The device id remains
 * the fallback, because most students have no account yet and an assistant
 * that refuses everyone until they sign up is worse than one that counts per
 * device.
 *
 * The 'u:' prefix keeps the two kinds of key from ever colliding in a column
 * that holds both.
 */
export function ownerKey({ userId, deviceId }) {
  return userId ? `u:${userId}` : (deviceId || '')
}

/** The cost of one action, from the owner's prices. */
export function costOf(kind, cfg) {
  const c = cfg || DEFAULT_POINTS
  return kind === 'image' ? c.image : c.message
}
