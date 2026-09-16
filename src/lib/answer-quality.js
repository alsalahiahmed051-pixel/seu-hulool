/**
 * Is this actually an answer, or just the first thing a provider said?
 *
 * ── «أحياناً تمام، أحياناً لا، يخبط» ─────────────────────────────────────
 *
 * That is not randomness. It is the name of whichever provider happened to
 * reply. Gemini answers well; when its free quota runs out the request falls
 * to Groq's Llama, whose Arabic is visibly weaker, and from there into
 * OpenRouter's free catalogue — a rotating set of experimental models. The
 * chain was built so the assistant never goes dark, and it works: something
 * always answers. But nothing ever looked at WHAT it answered.
 *
 * So one question got a real explanation and the next got a single word, a
 * sentence cut in half, English for an Arabic question, or the same line four
 * times — and every one of them was shown to the student as the answer,
 * because the loop's only test was `if (text)`.
 *
 * This is that missing test. A reply that fails it is not shown; the next
 * provider is asked instead. If every provider fails it, the least-bad reply
 * is still shown — a mediocre answer beats «تعذر».
 *
 * ── The bias, deliberately ──────────────────────────────────────────────
 *
 * Rejecting a GOOD answer is worse than passing a mediocre one: the student
 * waits longer and may end up with something weaker. So every rule here is
 * written to fire only on failures that are unmistakable, and a rule that
 * could not be made specific was left out rather than guessed at.
 */

const ARABIC = /[؀-ۿ]/g
const LATIN = /[A-Za-z]/g

const count = (s, re) => (String(s).match(re) || []).length

/** Fenced code, inline code and URLs are Latin by nature — not "wrong language". */
function prose(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\$[^$]*\$/g, ' ')
}

/**
 * A question that a short reply answers completely.
 *
 * «هلا» deserves «هلا فيك، كيف أقدر أساعدك؟» and nothing more, so the length
 * rule below must not call that a failure — the owner's own test case.
 */
// No `\b` anywhere: JavaScript defines a word boundary against `\w`, which is
// ASCII only, so `/هلا\b/` never matches «هلا» — the owner's own test case.
// The anchored punctuation tail does the same job and actually works in Arabic.
// «من أنت» is deliberately NOT here: that is a real question owed a real
// answer, not a greeting to be met with two words.
const GREETING = /^[\s]*(?:هلا|هلاً|أهلا|أهلاً|اهلا|اهلاً|مرحبا|مرحباً|السلام\s*عليكم|صباح\s*[\u0600-\u06FF]+|مساء\s*[\u0600-\u06FF]+|هاي|شكرا|شكراً|تمام|اوك|أوك|hi|hello|hey|salam|ok|okay|thanks|thank\s*you)[\s!؟.،,ـ]*$/iu

export const isGreeting = (q) => GREETING.test(String(q || '').trim())

/**
 * Words an Arabic sentence cannot end on.
 *
 * These are the high-confidence truncation signal: a reply that stops on a
 * conjunction or a preposition was cut off, not finished. Judging truncation
 * by "no full stop at the end" alone would reject plenty of good short
 * answers, so only this stricter form is used.
 */
const DANGLING = /(?:^|\s)(?:و|أو|او|ثم|لكن|لكنّ|كما|حيث|التي|الذي|الذين|هي|هو|في|من|على|إلى|الى|عن|مع|بين|عند|بعد|قبل|أن|إن|أنّ|لأن|لأنّ|كي|حتى|مثل|بسبب|يعني|is|are|the|and|or|of|to|for|with|that|which)\s*$/u

/** A heading or a list marker with nothing after it — the answer stopped mid-structure. */
const EMPTY_TAIL = /(?:^|\n)\s*(?:#{1,6}|[-*•]|\d+[.)])\s*$/u

/**
 * The same line, or the same long phrase, over and over.
 *
 * A weak model that loses the thread repeats. Four identical non-trivial lines
 * is far past anything a real answer does.
 */
function repeats(text) {
  const lines = String(text)
    .split(/\n+/)
    .map(l => l.trim().toLowerCase())
    .filter(l => l.length > 12)
  if (lines.length >= 4) {
    const seen = new Map()
    for (const l of lines) {
      const n = (seen.get(l) || 0) + 1
      if (n >= 4) return true
      seen.set(l, n)
    }
  }
  // A phrase repeated back-to-back many times, with or without line breaks.
  return /(.{15,}?)\1{3,}/s.test(String(text))
}

/** Boilerplate that is a refusal or a leaked template, never an answer. */
const NOT_AN_ANSWER = [
  /^\s*(?:as an ai|i'?m sorry, (?:but )?i (?:can'?t|cannot))/i,
  /^\s*(?:i am an ai language model)/i,
  /^\s*\{\s*"?(?:role|content|error|message)"?\s*:/i,
  /^\s*<\s*\/?\s*(?:html|body|!doctype)/i,
]

/**
 * Judge a reply against the question that produced it.
 *
 * @param {string} text the provider's reply
 * @param {string} question the student's last message
 * @returns {{ok: boolean, reason: string, score: number}}
 *   `score` ranks rejected replies so the loop can still show the least-bad
 *   one rather than an apology.
 */
export function judgeAnswer(text, question = '') {
  const raw = String(text || '')
  const t = raw.trim()
  if (!t) return { ok: false, reason: 'empty', score: 0 }

  for (const re of NOT_AN_ANSWER) {
    if (re.test(t)) return { ok: false, reason: 'boilerplate', score: 1 }
  }

  if (repeats(t)) return { ok: false, reason: 'repetition', score: 2 }

  // ── Cut off mid-thought ──────────────────────────────────────────────
  //
  // Checked BEFORE length on purpose. A reply that stops on «هو» is both
  // short and truncated, and "truncated" is the reason worth logging: it
  // says the provider was cut off, not that it answered briefly. With this
  // first, the length rule below only fires on replies that are genuinely
  // short AND complete — «نعم».
  if (DANGLING.test(t)) return { ok: false, reason: 'truncated', score: 4 }
  if (EMPTY_TAIL.test(t)) return { ok: false, reason: 'truncated-structure', score: 4 }
  // An opened fence that never closed.
  if ((t.match(/```/g) || []).length % 2 === 1) return { ok: false, reason: 'unclosed-code', score: 4 }

  // ── Length, measured against what was asked ──────────────────────────
  //
  // «يندي كلمة واحدة» — a one-word reply to a real question. A greeting is
  // exempt, because there a short reply is the correct one.
  const q = String(question || '').trim()
  const min = isGreeting(q) ? 2 : 40
  if (t.length < min) return { ok: false, reason: `too-short(${t.length})`, score: 3 }

  // ── The language the student wrote in ────────────────────────────────
  //
  // «ما يفرق بين اللغات». Only the clear case is caught: an Arabic question
  // answered in Latin prose. Code, formulae and links are stripped first, so
  // an answer that is mostly a code block is not mistaken for English.
  const body = prose(t)
  const qAr = count(q, ARABIC)
  const qLat = count(q, LATIN)
  const aAr = count(body, ARABIC)
  const aLat = count(body, LATIN)
  const askedInArabic = qAr > qLat && qAr >= 4
  if (askedInArabic && aLat >= 40 && aAr < aLat * 0.2) {
    return { ok: false, reason: 'wrong-language', score: 5 }
  }

  return { ok: true, reason: '', score: 100 + Math.min(100, Math.floor(t.length / 20)) }
}
