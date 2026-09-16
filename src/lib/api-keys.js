/**
 * More than one key per provider, so a free ceiling is not a single ceiling.
 *
 * ── The wall this exists to move ────────────────────────────────────────
 *
 * The site runs entirely on free tiers, and the owner's own diagnosis read:
 *
 *     جيميناي: انتهت الحصّة المجانية · Groq: انتهت الحصّة المجانية ·
 *     OpenRouter: المزوّد لم يستجب
 *
 * Nothing was broken. Every free allowance was simply spent. No amount of
 * retrying, reordering or rewriting moves that wall — the only thing that
 * moves it is more allowance, and on a free tier allowance is per KEY.
 *
 * So each provider may now hold several keys. One is the normal case and
 * behaves exactly as before; a second doubles the day's ceiling, a third
 * triples it. A key that answers 429 is set aside for the rest of the
 * request and the next one is tried, which is the whole idea.
 *
 * ── Naming ──────────────────────────────────────────────────────────────
 *
 * `GEMINI_API_KEY`, then `GEMINI_API_KEY_2`, `_3`, … in order. Nothing to
 * configure beyond adding the variable: the owner pastes a key into Vercel
 * and the ceiling rises on the next deploy.
 *
 * Read at CALL time, never at module load, so a test can set the environment
 * and so a redeploy is not required for the reader to see a new variable.
 */

/** A value that is actually a key rather than a leftover placeholder. */
const usable = (v, minLen) =>
  typeof v === 'string' &&
  v.trim().length >= minLen &&
  !/placeholder|your[_-]?key|xxx+|changeme/i.test(v)

/**
 * Every key configured for one provider, in the order they should be used.
 *
 * @param {string[]} names the base variable names to accept, best first
 *   (several because the project has historically used more than one spelling)
 * @param {number} minLen shortest plausible key for this provider
 * @returns {string[]} de-duplicated, placeholders removed
 */
export function readKeys(names, minLen = 20, env = process.env) {
  const out = []
  const seen = new Set()
  const add = (v) => {
    const k = typeof v === 'string' ? v.trim() : ''
    if (usable(k, minLen) && !seen.has(k)) { seen.add(k); out.push(k) }
  }
  for (const base of names) {
    add(env[base])
    // …_2 through …_9. A gap stops nothing: a key numbered 5 is still read
    // when 3 is missing, because a missing middle is a typo, not a limit.
    for (let i = 2; i <= 9; i++) add(env[`${base}_${i}`])
  }
  return out
}

/** The keys for each provider this site uses. */
export const geminiKeys = (env = process.env) =>
  readKeys(['GEMINI_API_KEY', 'GEMINI'], 20, env)
export const groqKeys = (env = process.env) =>
  readKeys(['GROQ_API_KEY', 'GROQ'], 20, env)
export const openRouterKeys = (env = process.env) =>
  readKeys(['OPENROUTER_API_KEY', 'OpenRouter'], 20, env)
export const anthropicKeys = (env = process.env) =>
  readKeys(['ANTHROPIC_API_KEY'], 20, env)

/**
 * Whether a refusal means "try the next key" rather than "give up".
 *
 * A spent quota and a rejected key are both about THIS key, so another one
 * may well work. Everything else — a timeout, a 5xx, a dead model name —
 * would meet the same wall under every key, and burning the spare on it
 * would spend the ceiling this file exists to raise.
 */
export function shouldTryNextKey(status, message) {
  const s = String(message || '')
  if (status === 429 || status === 401 || status === 403) return true
  return /quota|rate.?limit|exhaust|api key not valid|invalid api key|too many requests/i.test(s)
}
