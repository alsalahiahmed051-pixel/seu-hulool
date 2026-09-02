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
