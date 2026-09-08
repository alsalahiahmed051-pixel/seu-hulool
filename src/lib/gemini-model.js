/**
 * Which Gemini model to call — asked, not assumed.
 *
 * `gemini-1.5-flash` was written into four files by hand. Google retires
 * models on its own schedule, and a retired name answers 404 — so the provider
 * fails for a reason that has nothing to do with the key, the quota, or the
 * question, and the site can only say «تعذّر». It is a fault built into the
 * design rather than introduced by a change: the name was correct the day it
 * was typed and becomes wrong without anyone touching the file.
 *
 * The OpenRouter path already solved this by reading the catalogue instead of
 * naming a model. Google publishes the same thing, so this asks in the same
 * way: list what the key can actually call today, and pick from that.
 *
 * The hard-coded name stays as the last resort. If the listing cannot be
 * reached, an old guess still beats no request at all.
 */

const LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

/** The last name that worked, so the listing is fetched once an hour, not once a question. */
let cache = { at: 0, name: '' }
const TTL_MS = 60 * 60 * 1000

/** What to fall back on when Google cannot be asked. */
export const FALLBACK_MODEL = 'gemini-1.5-flash'

/**
 * Prefer a fast, current, generally-available flash model.
 *
 * Higher is better. «flash» is the free tier's workhorse and the only family
 * cheap enough to serve every student question; previews and experiments are
 * demoted rather than excluded, because on some keys they are all there is.
 */
function score(name) {
  let s = 0
  if (/flash/i.test(name)) s += 100
  if (/pro/i.test(name)) s += 40
  if (/-latest$/.test(name)) s += 15
  if (/preview|exp|experimental/i.test(name)) s -= 60
  if (/vision|embedding|aqa|imagen|tts|image/i.test(name)) s -= 200
  if (/lite/i.test(name)) s -= 10
  // A newer generation wins between two flashes: 2.5 beats 2.0 beats 1.5.
  const gen = name.match(/(\d+)\.(\d+)/)
  if (gen) s += Number(gen[1]) * 10 + Number(gen[2])
  return s
}

/**
 * A model id this key can call for text generation, e.g. "gemini-2.5-flash".
 *
 * @param {string} key      the API key
 * @param {(url: string, init?: object) => Promise<Response>} [fetcher]
 *        the caller's own timed fetch, so this obeys the same request clock as
 *        everything else rather than opening an unbounded one of its own
 */
export async function geminiModel(key, fetcher = fetch) {
  if (cache.name && Date.now() - cache.at < TTL_MS) return cache.name
  try {
    const r = await fetcher(`${LIST_URL}?key=${key}`)
    if (!r.ok) return FALLBACK_MODEL
    const data = await r.json()
    const usable = (data.models || [])
      // The listing includes embedding and image models that cannot answer a
      // question at all; only what supports generateContent is a candidate.
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name || '').replace(/^models\//, ''))
      .filter(Boolean)
      .sort((a, b) => score(b) - score(a))
    if (!usable.length) return FALLBACK_MODEL
    cache = { at: Date.now(), name: usable[0] }
    return usable[0]
  } catch {
    return FALLBACK_MODEL
  }
}

/** For tests: forget what was discovered. */
export function resetGeminiModelCache() {
  cache = { at: 0, name: '' }
}
