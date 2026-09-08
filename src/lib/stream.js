/**
 * Reading a provider's answer as it is written, instead of after it is done.
 *
 * ── Why ─────────────────────────────────────────────────────────────────
 * The site waited for the WHOLE answer and then printed it at once. Even at
 * its best that is several seconds of a blank bubble, and the owner's verdict
 * was the honest one: it does not feel like ChatGPT or Gemini, it feels like a
 * form being submitted. The models here have always streamed; the site simply
 * never asked them to.
 *
 * Streaming changes the number that actually matters. Total time stays what
 * the model needs, but TIME TO THE FIRST WORD drops to about a second — and a
 * reader who can see words arriving is not waiting, they are reading. It also
 * makes a stop button meaningful: there is now something in progress to stop,
 * and what was already written stays.
 *
 * ── Shape ───────────────────────────────────────────────────────────────
 * Both provider families speak Server-Sent Events over POST, differing only in
 * where the text sits inside each JSON frame. So the transport is parsed once
 * here, and each provider supplies a one-line extractor.
 */

/**
 * The `data:` payloads of an SSE body, in order, as they arrive.
 *
 * Frames are separated by a blank line and can be split across network chunks,
 * so the tail of each chunk is held back until its line is complete — reading
 * an SSE stream by chunk instead of by line is the classic way to lose or
 * corrupt the first token of an answer.
 */
export async function* sseFrames(body) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try { yield JSON.parse(payload) } catch { /* a partial frame is not an answer */ }
      }
    }
  } finally {
    // Whether we finished or the caller walked away, the socket is released —
    // a hedged race abandons losing providers by construction, so this is the
    // normal path, not the exceptional one.
    try { await reader.cancel() } catch { /* already gone */ }
  }
}

/** The text inside one Gemini SSE frame. */
export const geminiDelta = (f) => f?.candidates?.[0]?.content?.parts?.[0]?.text || ''

/** The text inside one OpenAI-shaped frame (Groq, OpenRouter). */
export const openaiDelta = (f) => f?.choices?.[0]?.delta?.content || ''

/**
 * Begin a provider's stream and hand it back ONLY once it has really spoken.
 *
 * This is what lets the hedged race work on streams: an attempt does not count
 * as won because a socket opened — a provider can accept the request and then
 * produce nothing at all, which is exactly what this site's free OpenRouter
 * models were doing. It counts as won when the first non-empty token is in
 * hand, and that token is kept and replayed so it is not lost to the test.
 *
 * @returns {Promise<{first: string, rest: AsyncGenerator<string>}>}
 * @throws if the provider refuses, or ends without producing any text
 */
export async function openStream(response, extract, label = 'provider') {
  if (!response.ok) {
    let detail = ''
    try {
      const d = await response.json()
      detail = d?.error?.message || ''
    } catch { /* an error page is not JSON; the status is enough */ }
    throw new Error(`${label}: HTTP ${response.status} ${detail}`.trim())
  }
  if (!response.body) throw new Error(`${label}: لا محتوى`)

  const frames = sseFrames(response.body)
  // Pull until something non-empty appears. Leading empty frames are normal —
  // providers send role announcements and keep-alives before any text.
  for (;;) {
    const { value, done } = await frames.next()
    if (done) throw new Error(`${label}: ردٌّ فارغ`)
    const text = extract(value)
    if (text) {
      return {
        first: text,
        async *rest() {
          for await (const frame of frames) {
            const t = extract(frame)
            if (t) yield t
          }
        },
      }
    }
  }
}
