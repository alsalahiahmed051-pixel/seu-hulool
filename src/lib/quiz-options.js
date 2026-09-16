/**
 * What a quiz can be built from, and how long it can be.
 *
 * Pure: no database, no network. These decide what reaches the model and how
 * much it is asked to produce, so they are worth being able to check without
 * standing a server up.
 */

/** Where the questions come from. */
export const QUIZ_SOURCES = {
  collections: {
    label: 'التجميعات المرفقة',
    ask: 'اعتمد على التجميعات والملخصات المرفقة',
  },
  curriculum: {
    label: 'المقرر الدراسي',
    ask: 'اعتمد على محتوى المقرر الدراسي ومفرداته',
  },
  summary: {
    label: 'التلخيص',
    ask: 'اعتمد على الملخصات، وركّز على النقاط الأساسية',
  },
  all: {
    label: 'عشوائي من كل شيء',
    ask: 'نوّع بين المقرر والتجميعات والملخصات',
  },
}

export const DEFAULT_SOURCE = 'all'

/** The most a student may ask for in one go. */
export const MAX_QUESTIONS = 30
export const MIN_QUESTIONS = 1
export const DEFAULT_QUESTIONS = 5

/**
 * A question count that is safe to act on.
 *
 * The field is free text so a student can type 17 rather than pick from a
 * short list — which means it can also arrive as "", "abc", 0, -4, 500 or
 * 12.7. An unclamped number here is a request that either produces nothing or
 * asks a provider for hundreds of questions.
 */
export function clampQuestions(v) {
  // Absent is not zero. Number('') and Number(null) are both 0, which the
  // clamp below would turn into a one-question quiz — so clearing the field
  // and pressing start would silently give you one question instead of the
  // default. Absent means "they did not say", and that is the default.
  if (v === '' || v === null || v === undefined) return DEFAULT_QUESTIONS
  if (typeof v === 'string' && v.trim() === '') return DEFAULT_QUESTIONS
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return DEFAULT_QUESTIONS
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, n))
}

/** A source key that is safe to act on; anything unknown becomes the mix. */
export function resolveSource(v) {
  return Object.prototype.hasOwnProperty.call(QUIZ_SOURCES, v) ? v : DEFAULT_SOURCE
}

/* ══════════════════════════════════════════════════════════════
   IS THIS A QUIZ, OR JUST VALID JSON?
   ══════════════════════════════════════════════════════════════
   The route's whole test was `Array.isArray(quiz) && quiz.length > 0`, so a
   provider only had to return a list. Everything below reached the student
   exactly as generated:

     • `answer: 7` against four options — a question NOBODY can get right,
       and the student is told they were wrong whatever they pick.
     • two options instead of four.
     • one question when thirty were asked.
     • the same question three times.
     • two identical choices, so two answers are correct and one is marked.

   Same shape of bug as the chat's «أحياناً تمام أحياناً يخبط», and the same
   cause: nothing looked at what came back. This looks.
*/

/** Letters a model may use for the answer instead of an index. */
const LETTER_INDEX = {
  'أ': 0, 'ا': 0, 'ب': 1, 'ج': 2, 'د': 3, 'هـ': 4, 'ه': 4,
  a: 0, b: 1, c: 2, d: 3, e: 4,
}

const cleanText = (v) => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : ''
const norm = (v) => cleanText(v).toLowerCase().replace(/[ً-ْ]/g, '').replace(/[.،,؟?!:]/g, '')

/**
 * Which option a model meant, however it said so.
 *
 * Models answer with an index, a letter («ب»), or the option's own text.
 * Converting those is strictly better than dropping the question over a
 * formatting choice — the question itself is usually fine.
 *
 * @returns {number} the option index, or -1 when it cannot be resolved
 */
function resolveAnswer(raw, options) {
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    return raw >= 0 && raw < options.length ? raw : -1
  }
  const s = cleanText(raw)
  if (!s) return -1
  // A plain numeral, one-based or zero-based — "3" with four options is
  // ambiguous, so only zero-based is trusted; a 1-based list would make
  // every answer off by one, which is worse than dropping the question.
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    return n >= 0 && n < options.length ? n : -1
  }
  const letter = LETTER_INDEX[s.replace(/[).\-\s]/g, '').toLowerCase()]
  if (letter !== undefined && letter < options.length) return letter
  // The answer written out as the option itself.
  const i = options.findIndex(o => norm(o) === norm(s))
  return i
}

/**
 * Keep only the questions a student can actually sit.
 *
 * @param {unknown} raw whatever the provider returned
 * @param {number} asked how many questions were requested
 * @returns {{quiz: Array, dropped: number, reason: string}}
 *   `quiz` is empty when too little survived to be worth showing — the route
 *   then tries the next provider instead of handing over a broken quiz.
 */
export function sanitiseQuiz(raw, asked = DEFAULT_QUESTIONS) {
  if (!Array.isArray(raw)) return { quiz: [], dropped: 0, reason: 'not-a-list' }

  const out = []
  const seen = new Set()
  let dropped = 0

  for (const item of raw) {
    if (!item || typeof item !== 'object') { dropped++; continue }

    const q = cleanText(item.q ?? item.question)
    if (q.length < 5) { dropped++; continue }

    // The same question twice is padding, not a longer quiz.
    const key = norm(q)
    if (seen.has(key)) { dropped++; continue }

    const options = (Array.isArray(item.options) ? item.options : [])
      .map(cleanText)
      .filter(Boolean)
    // Fewer than three choices is not multiple choice; more than six is a
    // list the model lost control of.
    if (options.length < 3 || options.length > 6) { dropped++; continue }
    // Two identical choices means two answers are right and one is marked.
    if (new Set(options.map(norm)).size !== options.length) { dropped++; continue }

    const answer = resolveAnswer(item.answer ?? item.correct ?? item.answerIndex, options)
    if (answer < 0) { dropped++; continue }

    seen.add(key)
    out.push({ q, options, answer })
    if (out.length >= asked) break
  }

  // A quiz that lost most of itself is a failed generation, not a short quiz:
  // better to ask the next provider than to hand over three questions when
  // thirty were asked. One question asked for and one delivered is fine.
  const wanted = clampQuestions(asked)
  const floor = Math.max(1, Math.ceil(wanted / 2))
  if (out.length < floor) {
    return { quiz: [], dropped, reason: `too-few(${out.length}/${wanted})` }
  }
  return { quiz: out, dropped, reason: '' }
}
