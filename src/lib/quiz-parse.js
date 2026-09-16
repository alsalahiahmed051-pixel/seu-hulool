/**
 * Reading a quiz out of what a model actually sent.
 *
 * ── Why the quiz died where the chat survived ───────────────────────────
 *
 * Both call the same providers. The chat accepts any text, so when Gemini's
 * free quota runs out and the question falls to a weaker model, the chat still
 * gets an answer — a bit worse, but an answer. The quiz needs valid JSON, and
 * that is exactly what a weaker model, or a reply cut off at the token limit,
 * fails to produce. So the same fallback that keeps the chat alive kills the
 * quiz, and the owner sees «الاختبار ما يشتغل» while the chat works.
 *
 * The old parser was all-or-nothing, twice:
 *
 *     try { return JSON.parse(text) } catch {}
 *     const m = text.match(/\[[\s\S]*\]/)
 *     if (m) { try { return JSON.parse(m[0]) } catch {} }
 *     return null
 *
 * A thirty-question quiz that stopped one character into question twenty-three
 * has twenty-two perfectly good questions in it — and returned NOTHING, because
 * the array never closed.
 *
 * ── What this does instead ──────────────────────────────────────────────
 *
 * Try the clean paths first, then SALVAGE: walk the text and pull out every
 * balanced `{…}` that parses on its own. A truncated reply gives up its
 * complete questions and drops only the half-written one. `sanitiseQuiz` then
 * decides whether what survived is enough to be worth showing.
 *
 * Nothing here invents content. Salvage only ever returns objects the model
 * actually finished writing.
 */

/** Models wrap JSON in ```json fences, or in a sentence, or both. */
function unwrap(text) {
  let t = String(text || '').trim()
  // ```json … ``` or ``` … ```
  const fence = t.match(/```(?:json|JSON)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  // A model that opened a fence and was cut off never closes it.
  else t = t.replace(/^```(?:json|JSON)?\s*/i, '')
  return t
}

/**
 * The repairs that are safe because they cannot change meaning.
 *
 * Trailing commas and the curly quotes a model picks up from Arabic prose are
 * formatting slips, not content. Nothing here rewrites a value.
 */
function repair(s) {
  return String(s)
    // Smart quotes around JSON syntax — never inside a value, because the
    // pattern requires them to sit against a brace, bracket, colon or comma.
    .replace(/[“”]/g, '"')
    // A trailing comma before a closer.
    .replace(/,\s*([}\]])/g, '$1')
    // Arabic comma used as a separator by a model writing Arabic.
    .replace(/،\s*(?=["}\]])/g, ',')
}

const tryParse = (s) => {
  try { return JSON.parse(s) } catch {}
  try { return JSON.parse(repair(s)) } catch {}
  return null
}

/**
 * Every balanced `{…}` in the text, as source strings.
 *
 * Walks character by character so a brace inside a string value — «ما معنى {س}؟»
 * — does not end an object early, and a backslash escape does not end a string.
 */
function objectChunks(text) {
  const out = []
  const s = String(text)
  let depth = 0
  let start = -1
  let inStr = false
  let esc = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') { inStr = true; continue }
    if (c === '{') {
      if (depth === 0) start = i
      depth++
    } else if (c === '}') {
      if (depth > 0) {
        depth--
        if (depth === 0 && start >= 0) {
          out.push(s.slice(start, i + 1))
          start = -1
          if (out.length >= 200) break
        }
      }
    }
  }
  return out
}

/**
 * Read a quiz from a provider's reply.
 *
 * @param {string} text whatever came back
 * @returns {Array|null} the questions, or null when nothing could be read
 */
export function parseQuiz(text) {
  const t = unwrap(text)
  if (!t) return null

  // 1) The clean case: the whole reply is the array.
  const whole = tryParse(t)
  if (Array.isArray(whole)) return whole
  // Some models wrap it: {"questions": [...]} or {"quiz": [...]}.
  if (whole && typeof whole === 'object') {
    for (const key of ['quiz', 'questions', 'items', 'data', 'result']) {
      if (Array.isArray(whole[key])) return whole[key]
    }
  }

  // 2) An array sitting inside prose. Greedy, so it takes the outermost pair.
  const arr = t.match(/\[[\s\S]*\]/)
  if (arr) {
    const parsed = tryParse(arr[0])
    if (Array.isArray(parsed)) return parsed
  }

  // 3) SALVAGE — the case the old parser threw away.
  //
  // A reply cut off at the token limit, or an array the model never closed,
  // still holds every question it finished. Take those and drop the fragment.
  const chunks = objectChunks(t)
  if (chunks.length) {
    const items = []
    for (const c of chunks) {
      const o = tryParse(c)
      // Only things shaped like a question; a stray metadata object is not one.
      if (o && typeof o === 'object' && !Array.isArray(o) && (o.q || o.question)) {
        items.push(o)
      }
    }
    if (items.length) return items
  }

  return null
}
