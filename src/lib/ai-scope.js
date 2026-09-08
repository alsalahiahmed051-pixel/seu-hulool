/**
 * What the assistant is about — and what it refuses.
 *
 * These used to be the same thing, and that was the mistake.
 *
 * The chat was told: «إذا سُئلت عن شيء خارج الدراسة الجامعية… لا تجب عن الموضوع
 * الخارجي». So a student who asked anything else — a word in English, how to
 * write an email, what a term in the news means — was turned away by the one
 * assistant they had. The owner's instruction is plain: «يجيب على أي سؤال كأنه
 * أنت أو أي ذكاء». A refusal is not a smaller answer, it is no answer, and a
 * student who is refused once stops asking.
 *
 * So SPECIALITY and PERMISSION are separated here:
 *   • The CHAT has a speciality, not a fence. It is an SEU assistant first —
 *     it leads with the course, grounds in its files, and knows the university
 *     — and it answers whatever else is asked instead of apologising.
 *   • The QUIZ keeps the fence. Its questions rehearse a specific course for a
 *     specific paper, and general trivia in an ACCT101 quiz is not a broader
 *     service, it is a broken one. That is why `quizScope` below is unchanged.
 */

import { ALL_COURSE_NAMES, canonicalCourse, isCourseCode, titleOf, titleArOf, programsOf } from '@/lib/courses'

export const GENERAL = 'عام'

export const isGeneral = (subject) => String(subject || '').trim() === GENERAL

/**
 * The subject a request may actually ask about.
 *
 * `subject` arrives from the browser and was only ever length-checked, so it
 * was a free string interpolated into the system prompt — anything a caller
 * typed became "تخصصك مادة X" and steered the assistant wherever they liked.
 * Anything that is not a real course in the catalogue is treated as the
 * general assistant, which is still university-scoped.
 *
 * Course CODES count, not only programme names. When the assistant's picker
 * started offering a student their own level's courses, every one of them —
 * ACCT101, STAT101, CS230 — failed this check and was silently downgraded to
 * "عام": the confirm screen promised an answer about a specific course and the
 * server answered as the general assistant, which does not know which course
 * it is talking about. That is the "يخبص في الإجابات" the owner reported.
 */
export function resolveSubject(subject) {
  const s = String(subject || '').trim()
  if (!s || isGeneral(s)) return GENERAL
  const c = canonicalCourse(s)
  if (isCourseCode(c)) return c
  return ALL_COURSE_NAMES.includes(c) ? c : GENERAL
}

/**
 * How a subject reads to the model.
 *
 * "تخصصك مادة ACCT101" tells a model almost nothing — a code is a filing key,
 * not a subject, and an answer built on it is a guess. The name is what makes
 * the answer right, so a code is expanded to everything the catalogue knows:
 * the English name, the Arabic one, and which programmes teach it.
 */
export function describeSubject(subject) {
  const s = String(subject || '').trim()
  if (!isCourseCode(s)) return s
  const en = titleOf(s)
  const ar = titleArOf(s)
  // titleOf returns English where a plan printed one and Arabic otherwise, so
  // `ar` is only non-empty when it adds a second name.
  const names = [en, ar].filter(Boolean).join(' — ')
  const progs = (programsOf(s) || []).slice(0, 3)
  const where = progs.length ? `، تُدرَّس ضمن خطة ${progs.join(' و')}` : ''
  return names ? `${s} (${names})${where}` : s
}

/** The university this site serves — the fixed frame around every answer. */
const UNIVERSITY = `الجامعة السعودية الإلكترونية (SEU) — جامعة حكومية سعودية للتعليم المدمج، تضم السنة التحضيرية (مسار علمي/إداري، خطة أ وخطة ب) ودرجات البكالوريوس والدبلوم والدراسات العليا، وتعتمد على البلاكبورد والحضور الافتراضي والحضوري.`

/** The topics a "عام" question may be about. */
const IN_SCOPE = `- مواد الجامعة ومحتواها الدراسي وشرح مفاهيمها
- السنة التحضيرية والمسارات والتخصصات والكليات والخطط الدراسية
- الاختبارات والواجبات والتقديرات والمعدل والأنشطة
- أنظمة الجامعة: البلاكبورد، التسجيل، الحذف والإضافة، الحضور، الاعتذار، التقويم الأكاديمي
- مهارات الدراسة والتنظيم والمذاكرة والاستعداد للاختبارات`

/**
 * Answer the question that was asked.
 *
 * The speciality above says what this assistant is FOR; this says it is still
 * an assistant when the question falls outside it. Refusing was never a safety
 * measure here — it was a product decision, and the owner has reversed it.
 */
const ANSWER_ANYTHING = `أجب عن أيّ سؤالٍ يُطرح عليك، داخل نطاق تخصصك أو خارجه، كما يفعل أيُّ مساعدٍ ذكيٍّ عام. لا تعتذر عن السؤال ولا تردّ الطالب لأنه «خارج النطاق».
وإن كان السؤال بعيداً عن الدراسة فأجب عنه مباشرةً وباختصار، ثم عد إلى شأنك الأساسي إن كان لذلك محلّ.`

/**
 * The one thing a wider scope makes more dangerous, not less.
 *
 * Inside a course the files are there to check an answer against. Outside it
 * there is nothing, so the temptation to invent a regulation or a deadline
 * grows exactly as the fence comes down — and a confident wrong answer about a
 * registration date costs a student more than a refusal ever did.
 */
const HONESTY = `لا تخترع أنظمةً أو مواعيدَ أو أرقاماً أو مصادر لا تعرفها. إن لم تكن متأكداً فقل ذلك صراحةً في سطر، ووجّه الطالب إلى الجهة المختصة في الجامعة عندما يكون السؤال عن نظامٍ أو موعدٍ رسمي.
وابقَ موجزاً: أجب عن المسؤول عنه دون حشو.`

/**
 * The scoping paragraph appended to every system prompt.
 * `subject` is the course name, or "عام" for the general assistant.
 */
export function scopeRules(subject) {
  const speciality = isGeneral(subject)
    ? `تخصصك الدراسةُ في هذه الجامعة: ${IN_SCOPE}`
    : `تخصصك مادة "${describeSubject(subject)}". إن كان السؤال متصلاً بها فاربط إجابتك بها وبملفاتها.`

  return `أنت مساعدٌ ذكيٌّ كامل، ومساعدُ طلاب ${UNIVERSITY}
${speciality}

${ANSWER_ANYTHING}
${HONESTY}`
}

/** How a quiz should be framed — the same boundary, for generated questions. */
export function quizScope(subject) {
  if (!isGeneral(subject)) {
    return `أسئلة من محتوى مادة "${describeSubject(subject)}" في ${UNIVERSITY}`
  }
  return `أسئلة عامة لطلاب ${UNIVERSITY} من داخل نطاق الدراسة الجامعية فقط:
${IN_SCOPE}
لا تُنشئ أسئلة ثقافة عامة أو رياضة أو ترفيه أو أي شيء خارج الدراسة الجامعية.`
}
