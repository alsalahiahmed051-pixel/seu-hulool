/**
 * Calling Gemini without betting the request on a model name.
 *
 * ── The first bug ───────────────────────────────────────────────────────
 * `gemini-1.5-flash` was written into four files by hand. Google retires
 * models on its own schedule, and a retired name answers 404 — so the provider
 * failed for a reason that had nothing to do with the key, the quota, or the
 * question, and the site could only say «تعذّر».
 *
 * ── The bug I shipped fixing it ─────────────────────────────────────────
 * The first attempt asked Google for its catalogue before every question and
 * fell back to the hard-coded name when the listing could not be reached. Both
 * halves were wrong:
 *
 *   • The listing sat on the hot path. Each cold start — which on this plan is
 *     most requests — paid a whole extra round-trip to Google BEFORE the
 *     question was sent. I made every answer slower in the act of fixing it.
 *   • The fallback was the retired name. A fallback that is known-broken is
 *     not a fallback; one hiccup in the listing put the site back on the exact
 *     404 the change existed to prevent.
 *
 * ── What this does instead ──────────────────────────────────────────────
 * Call the model we believe in, and only ask Google anything when that belief
 * turns out to be wrong. The happy path costs nothing, the unhappy path costs
 * one listing and then repairs itself for an hour. The names below are the
 * generally-available ones; the listing is what settles it when they are not.
 */

const LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEN_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Where to start before Google has been asked anything.
 *
 * Deliberately a CURRENT generally-available model, not the newest preview and
 * never a retired one: this name is what a request rides on when the listing
 * is unreachable, so it has to be the safest guess available rather than the
 * best one.
 */
export const FALLBACK_MODEL = 'gemini-2.0-flash'

/** The name last proven to work, kept an hour so discovery is rare. */
let cache = { at: 0, name: '' }
const TTL_MS = 60 * 60 * 1000

/** The model to try first — answered from memory, never over the network. */
export function preferredModel() {
  return cache.name && Date.now() - cache.at < TTL_MS ? cache.name : FALLBACK_MODEL
}

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
 * Ask Google what this key can actually call today, and remember the answer.
 *
 * Returns '' when the listing cannot be reached or holds nothing usable — the
 * caller then has nothing better to try, which is the honest outcome.
 */
export async function discoverModel(key, fetcher = fetch) {
  try {
    const r = await fetcher(`${LIST_URL}?key=${key}`)
    if (!r.ok) return ''
    const data = await r.json()
    const usable = (data.models || [])
      // The listing includes embedding and image models that cannot answer a
      // question at all; only what supports generateContent is a candidate.
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name || '').replace(/^models\//, ''))
      .filter(Boolean)
      .sort((a, b) => score(b) - score(a))
    if (!usable.length) return ''
    cache = { at: Date.now(), name: usable[0] }
    return usable[0]
  } catch {
    return ''
  }
}

/**
 * Whether a refusal is about the NAME rather than the key, the quota, or the
 * question — the only case worth spending a listing on.
 *
 * A retired or misspelled model is a 404, and some rejections arrive as a 400
 * that says so in words. Everything else (401 bad key, 429 out of quota, 5xx)
 * would meet the same wall under any other name, so re-asking would only add
 * a round-trip to a failure that is already decided.
 */
function isModelFault(status, message) {
  if (status === 404) return true
  return status === 400 && /model|not found|not supported/i.test(String(message || ''))
}

/**
 * Generate with Gemini, repairing the model name if that is what is wrong.
 *
 * One request on the happy path. When the name is the problem — and only then —
 * it asks for the catalogue, retries once, and caches what worked so the next
 * hour of questions goes straight through.
 *
 * @returns {Promise<string>} the answer text ('' if the model returned nothing)
 * @throws  {Error} carrying the provider's own reason when it refused
 */
export async function geminiGenerate(key, body, fetcher = fetch) {
  const post = (model) => fetcher(
    `${GEN_URL}/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  const textOf = (d) => d?.candidates?.[0]?.content?.parts?.[0]?.text || ''

  let model = preferredModel()
  let r = await post(model)
  let d = await r.json().catch(() => ({}))

  if (!r.ok && isModelFault(r.status, d?.error?.message)) {
    const found = await discoverModel(key, fetcher)
    if (found && found !== model) {
      model = found
      r = await post(model)
      d = await r.json().catch(() => ({}))
    }
  }

  if (!r.ok) throw new Error(`${model}: HTTP ${r.status} ${d?.error?.message || ''}`.trim())
  // A name that answered is a name worth keeping, even if it was the default.
  if (cache.name !== model) cache = { at: Date.now(), name: model }
  return textOf(d)
}

/**
 * The same self-healing name logic, but handing back the raw streaming
 * response for the caller to read token by token.
 *
 * It cannot share `geminiGenerate`'s body because that one consumes the
 * response as JSON, which is exactly what a stream must not do. What the two
 * share is the rule that matters: try the name we trust, and re-ask Google
 * only when the NAME is what it objected to.
 */
export async function geminiStreamRequest(key, body, fetcher = fetch) {
  const post = (model) => fetcher(
    `${GEN_URL}/${model}:streamGenerateContent?alt=sse&key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )

  let model = preferredModel()
  let r = await post(model)

  if (!r.ok && r.status === 404) {
    const found = await discoverModel(key, fetcher)
    if (found && found !== model) {
      model = found
      r = await post(model)
    }
  }
  if (r.ok && cache.name !== model) cache = { at: Date.now(), name: model }
  return r
}

/** For tests: forget what was discovered. */
export function resetGeminiModelCache() {
  cache = { at: 0, name: '' }
}
