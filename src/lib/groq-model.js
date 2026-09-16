/**
 * Calling Groq without betting the request on a model name.
 *
 * ── Why this exists ─────────────────────────────────────────────────────
 *
 * Exactly the bug `gemini-model.js` was written for, on the other provider.
 * `llama3-70b-8192` was hardcoded here until Groq decommissioned it, and
 * every call through that name then failed for a reason that had nothing to
 * do with the key, the quota or the question. It was replaced by hand with
 * two newer names — which is the same mistake with a later expiry date.
 *
 * Providers retire models on their own schedule and do not ask. A name
 * written into the source is a time bomb with the fuse set by someone else,
 * and the site reads it as «المساعد الذكي غير متاح».
 *
 * So: call the name we believe in, and only ask Groq for its catalogue when
 * that belief turns out to be wrong. The happy path costs one request; the
 * unhappy one costs a listing and then repairs itself for an hour.
 */

const BASE = 'https://api.groq.com/openai/v1'

/** Where to start before Groq has been asked anything. */
export const FALLBACK_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

let cache = { at: 0, names: [] }
const TTL_MS = 60 * 60 * 1000

/** The models to try first — answered from memory, never over the network. */
export function preferredModels() {
  return cache.names.length && Date.now() - cache.at < TTL_MS ? cache.names : FALLBACK_MODELS
}

/**
 * Rank what Groq is serving, for an Arabic study assistant.
 *
 * Bigger instruction-tuned chat models first; speech, guard and vision models
 * are demoted rather than removed, because on a given day they may be all the
 * catalogue holds and a weak answer still beats «غير متاح».
 */
function score(id) {
  let s = 0
  if (/llama-?3\.[3-9]|llama-?4/i.test(id)) s += 100
  else if (/llama/i.test(id)) s += 70
  if (/qwen|deepseek|kimi|mixtral/i.test(id)) s += 80
  if (/70b|72b|90b|120b|235b/i.test(id)) s += 40
  if (/versatile|instruct/i.test(id)) s += 20
  if (/\b(1|3|7|8)b\b/i.test(id)) s -= 10
  if (/instant/i.test(id)) s -= 5
  if (/whisper|tts|guard|safety|vision|embed/i.test(id)) s -= 300
  if (/preview|deprecated/i.test(id)) s -= 40
  return s
}

/**
 * Ask Groq what this key can actually call today, and remember the answer.
 *
 * @returns {Promise<string[]>} best-first; empty when the listing is
 *   unreachable or holds nothing usable, which is the honest outcome.
 */
export async function discoverGroqModels(key, fetcher = fetch) {
  try {
    const r = await fetcher(`${BASE}/models`, { headers: { Authorization: `Bearer ${key}` } })
    if (!r.ok) return []
    const data = await r.json()
    const usable = (data.data || [])
      .map(m => String(m?.id || ''))
      .filter(Boolean)
      .filter(id => score(id) > -100)
      .sort((a, b) => score(b) - score(a))
      .slice(0, 4)
    if (!usable.length) return []
    cache = { at: Date.now(), names: usable }
    return usable
  } catch {
    return []
  }
}

/** A refusal about the NAME rather than the key, the quota or the question. */
function isModelFault(status, message) {
  if (status === 404) return true
  const m = String(message || '')
  return status === 400 && /model|decommission|not found|does not exist|no longer/i.test(m)
}

/**
 * Chat with Groq, repairing the model name if that is what is wrong.
 *
 * @returns {Promise<string>} the reply text
 * @throws  {Error} carrying the provider's own reason when it refused
 */
export async function groqChat(key, messages, opts = {}, fetcher = fetch) {
  const post = (model) => fetcher(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, ...opts }),
  })

  const tried = []
  let lastErr = ''
  let nameFault = false

  for (const model of preferredModels()) {
    try {
      const r = await post(model)
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        const text = d.choices?.[0]?.message?.content
        if (text) {
          if (!cache.names.includes(model)) cache = { at: Date.now(), names: [model, ...cache.names].slice(0, 4) }
          return text
        }
        lastErr = `${model}: empty reply`
        continue
      }
      lastErr = `${model}: HTTP ${r.status} ${d?.error?.message || ''}`.trim()
      if (isModelFault(r.status, d?.error?.message)) nameFault = true
      // A bad key or an exhausted quota meets the same wall under every name.
      else if (r.status === 401 || r.status === 403 || r.status === 429) break
    } catch (e) {
      lastErr = `${model}: ${e.message}`
    }
    tried.push(model)
  }

  // Only when the NAMES were the problem is a listing worth a round trip.
  if (nameFault) {
    const found = (await discoverGroqModels(key, fetcher)).filter(m => !tried.includes(m))
    for (const model of found) {
      try {
        const r = await post(model)
        const d = await r.json().catch(() => ({}))
        if (r.ok) {
          const text = d.choices?.[0]?.message?.content
          if (text) return text
        }
        lastErr = `${model}: HTTP ${r.status} ${d?.error?.message || ''}`.trim()
      } catch (e) { lastErr = `${model}: ${e.message}` }
    }
  }

  throw new Error(lastErr || 'Groq returned nothing')
}

/** For tests: forget what was discovered. */
export function resetGroqModelCache() {
  cache = { at: 0, names: [] }
}

/* ══════════════════════════════════════════════════════════════
   SPEECH — the same rule, for the voice button
   ══════════════════════════════════════════════════════════════ */

/** Where transcription starts before Groq has been asked anything. */
export const FALLBACK_SPEECH = ['whisper-large-v3-turbo', 'whisper-large-v3']

let speechCache = { at: 0, names: [] }

/** Speech models to try first — from memory, never over the network. */
export function preferredSpeechModels() {
  return speechCache.names.length && Date.now() - speechCache.at < TTL_MS
    ? speechCache.names
    : FALLBACK_SPEECH
}

/** Prefer a fast, current large Whisper; anything else is a last resort. */
function speechScore(id) {
  let s = 0
  if (/whisper/i.test(id)) s += 100
  if (/large/i.test(id)) s += 40
  if (/turbo/i.test(id)) s += 20
  if (/v3/i.test(id)) s += 10
  if (/en$|english/i.test(id)) s -= 50 // an English-only model cannot hear Arabic
  return s
}

/** Ask Groq which speech models this key can call today. */
export async function discoverSpeechModels(key, fetcher = fetch) {
  try {
    const r = await fetcher(`${BASE}/models`, { headers: { Authorization: `Bearer ${key}` } })
    if (!r.ok) return []
    const data = await r.json()
    const usable = (data.data || [])
      .map(m => String(m?.id || ''))
      .filter(id => /whisper|transcribe|speech/i.test(id))
      .sort((a, b) => speechScore(b) - speechScore(a))
      .slice(0, 3)
    if (!usable.length) return []
    speechCache = { at: Date.now(), names: usable }
    return usable
  } catch {
    return []
  }
}

/** For tests: forget what was discovered. */
export function resetSpeechModelCache() {
  speechCache = { at: 0, names: [] }
}
