/**
 * Which language a piece of text is written in.
 *
 * Decided here, in code, rather than left to the model. «Answer in the language
 * of the question» is a sentence a model interprets; «أجب بالعربية» is one it
 * obeys. So the language is measured first and the prompt is written in the
 * definite, and the answer stops depending on which provider served the turn.
 *
 * A note on why two thresholds and not one — a QUESTION and a DOCUMENT are
 * different measurements:
 *
 *   • «ما معنى depreciation؟» is an Arabic question. Half its letters are
 *     Latin, because the term being asked about is English, and a person who
 *     writes their sentence in Arabic wants their answer in Arabic. Arabic in
 *     a question is a strong signal even in the minority.
 *   • An accounting textbook with «الفصل الأول» stamped on the cover is an
 *     English document. Here the majority is what counts.
 *
 * One threshold would have to be wrong about one of them, so there are two.
 */

const IS_LETTER = /\p{L}/u
const IS_ARABIC = /\p{Script=Arabic}/u
const IS_LATIN = /\p{Script=Latin}/u

/**
 * How many letters of each script — and letters only.
 *
 * The letter test is not decoration. Arabic punctuation lives inside the Arabic
 * Unicode block: «؟» is U+061F, and counting it as a letter made every question
 * mark a vote for Arabic. So «؟؟؟ 123» read as an Arabic sentence, and a caller
 * with no letters at all was told a language anyway. A letter is a letter; a
 * question mark, a digit, a diacritic and a space are not evidence of anything.
 *
 * Bounded on purpose: a document's language is settled long before its end, and
 * this runs over passages up to eight thousand characters on every request.
 */
function letterCounts(text, limit = 4000) {
  let ar = 0, la = 0, seen = 0
  for (const ch of String(text || '')) {
    if (seen++ >= limit) break
    if (!IS_LETTER.test(ch)) continue
    if (IS_ARABIC.test(ch)) ar++
    else if (IS_LATIN.test(ch)) la++
  }
  return { ar, la, total: ar + la }
}

/**
 * The language someone WROTE IN — for choosing the language to answer in.
 *
 * Arabic wins from a minority, because a question in Arabic carrying English
 * terms is an Arabic question; that is the ordinary shape of a question about
 * an English-taught course.
 *
 * @returns {'ar'|'en'|''} '' when there are no letters to judge by
 */
export function askScript(text) {
  const { ar, la, total } = letterCounts(text)
  if (!total) return ''
  if (ar / total >= 0.3) return 'ar'
  return la ? 'en' : 'ar'
}

/**
 * The language a DOCUMENT is in — for matching the material a student is
 * examined on.
 *
 * Majority rules, and a genuinely mixed document is reported as mixed rather
 * than forced into one side: a quiz over bilingual material should follow the
 * material, not a coin toss.
 *
 * @returns {'ar'|'en'|'mixed'|''}
 */
export function docScript(text) {
  const { ar, la, total } = letterCounts(text)
  if (total < 20) return ''            // too little text to call
  const share = ar / total
  if (share >= 0.65) return 'ar'
  if (share <= 0.2) return 'en'
  return 'mixed'
}

/** The name of a language, in Arabic, for writing into a prompt. */
export const LANG_NAME = {
  ar: 'العربية',
  en: 'الإنجليزية',
  mixed: 'العربية والإنجليزية معاً',
}
