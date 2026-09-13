/**
 * What the assistant is allowed to be about.
 *
 * The per-course assistant is naturally bounded — its subject is the course.
 * The general one ("عام") was not: asked anything, it answered anything, and a
 * quiz generated for "مادة عام" came back as general trivia rather than
 * university material. Both are the same product to a student, so both are
 * scoped here, in one place, rather than drifting apart in two route files.
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
 * The scoping paragraph appended to every system prompt.
 * `subject` is the course name, or "عام" for the general assistant.
 */
export function scopeRules(subject) {
  if (!isGeneral(subject)) {
    return `أنت مساعد أكاديمي لطلاب ${UNIVERSITY}
تخصصك مادة "${describeSubject(subject)}". اجعل كل إجابة متصلة بالمادة أو بالدراسة في الجامعة.
إذا سُئلت عن شيء خارج الدراسة الجامعية، اعتذر بلطف في سطر واحد واقترح سؤالاً دراسياً بديلاً، ولا تجب عن الموضوع الخارجي.`
  }
  return `أنت المساعد العام لطلاب ${UNIVERSITY}
تجيب فقط عمّا يخص الدراسة في هذه الجامعة:
${IN_SCOPE}

خارج هذا النطاق — الرياضة، السياسة، الترفيه، الأخبار، الطب، البرمجة غير الدراسية، أو أي طلب لا صلة له بالجامعة — لا تجب عن الموضوع. اعتذر بسطر واحد ووجّه الطالب إلى سؤال دراسي، مثل: «أنا مساعد خاص بالدراسة في الجامعة السعودية الإلكترونية — اسألني عن موادك أو اختباراتك أو خطتك الدراسية.»
لا تخترع أنظمة أو مواعيد أو أرقام لا تعرفها؛ إن لم تكن متأكداً قل ذلك ووجّه الطالب إلى الجهة المختصة في الجامعة.`
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
