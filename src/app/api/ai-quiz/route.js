import { aiPerMinuteLimit, aiDailyLimit, callerKey } from '@/lib/rate-limit'
import { deviceIdentity, paidQuotaExhausted, consumePaidQuota } from '@/lib/ai-quota'
import { quizScope, isGeneral, resolveSubject } from '@/lib/ai-scope'
import { QUIZ_SOURCES, resolveSource, clampQuestions, sanitiseQuiz } from '@/lib/quiz-options'
import { isSubscribed } from '@/lib/ai-usage'
import { ownerKey } from '@/lib/ai-points'
import { modelScore } from '@/lib/model-rank'
import { contextFor } from '@/lib/retrieval'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { withDeadline, budget } from '@/lib/deadline'
import { explainFailure } from '@/lib/provider-errors'
import { isUsable, cooldownLeft, noteFailure, noteSuccess } from '@/lib/provider-health'
import { parseQuiz } from '@/lib/quiz-parse'
import { geminiGenerate } from '@/lib/gemini-model'
import { groqChat } from '@/lib/groq-model'
import { geminiKeys, groqKeys, openRouterKeys, anthropicKeys } from '@/lib/api-keys'

export const runtime = 'nodejs'
// The platform kills a function at ten seconds unless told otherwise.
export const maxDuration = 60

/**
 * Every key configured per provider, not just the first.
 *
 * A free ceiling is per KEY, and the owner's own diagnosis read «انتهت
 * الحصّة المجانية» on every provider at once. A second `GEMINI_API_KEY_2`
 * doubles the day's allowance with no other change. See src/lib/api-keys.js.
 *
 * `[0]` is kept for the places that only need to know whether a provider is
 * configured at all; the CALLS get the whole set.
 */
const GEMINI_SET = geminiKeys()
const GROQ_SET = groqKeys()
const OPENROUTER_SET = openRouterKeys()
const ANTHROPIC_SET = anthropicKeys()

const ANTHROPIC_KEY = ANTHROPIC_SET[0] || ''
const GROQ_KEY = GROQ_SET[0] || ''
const GEMINI_KEY = GEMINI_SET[0] || ''
const OPENROUTER_KEY = OPENROUTER_SET[0] || ''

/**
 * Room for `count` questions.
 *
 * It was a flat 1024 for every request. A thirty-question quiz in Arabic needs
 * roughly three times that, so the JSON stopped mid-array, `parseQuiz` could
 * not read it, and the student got a failed or short quiz — with nothing on
 * screen saying why. The budget follows the size of what was asked for.
 */
function quizTokens(count) {
  return Math.min(8192, Math.max(1024, 400 + (Number(count) || 5) * 140))
}

function buildQuizSystem(subject, grounding) {
  let sys = `أنت مساعد اختبارات لطلاب الجامعة السعودية الإلكترونية (SEU).
${quizScope(subject)}

أعد JSON فقط بهذا الشكل: [{"q":"السؤال","options":["أ","ب","ج","د"],"answer":0}]. لا تكتب أي نص خارج JSON.`

  // «التجميعات المرفقة» used to be a SENTENCE in the prompt — «اعتمد على
  // التجميعات والملخصات المرفقة» — with nothing attached. The model was told
  // to build questions from material it had never been given, so it invented
  // material and then questions about it. These are the actual files.
  if (grounding && grounding.context) {
    sys += `

── مقاطع من ملفات هذه المادة ──
${grounding.context}
── نهاية المقاطع ──

ابنِ الأسئلة من هذه المقاطع. المقاطع مستخرجة آلياً وقد تحتوي تشويهاً — تجاهل المشوّه ولا تبنِ عليه سؤالاً.
لا تسأل عمّا ليس في المقاطع إن طُلب منك الاعتماد عليها.`
  }
  return sys
}

/** What we ask for — the general assistant must not produce trivia. */
function quizAsk(subject, count = 5, source = 'all') {
  const from = QUIZ_SOURCES[source]?.ask || ''
  const tail = from ? ` ${from}.` : ''
  return isGeneral(subject)
    ? `أنشئ ${count} أسئلة اختيار من متعدد لطلاب الجامعة السعودية الإلكترونية عن الدراسة الجامعية وأنظمتها ومهارات المذاكرة.${tail}`
    : `أنشئ ${count} أسئلة اختيار من متعدد عن مادة "${subject}".${tail}`
}


async function callAnthropic(subject, count, source, grounding) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY })
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: quizTokens(count),
    system: buildQuizSystem(subject, grounding),
    messages: [{ role: 'user', content: quizAsk(subject, count, source) }],
  })
  return parseQuiz(res.content[0]?.text || '')
}

async function getFreeModels() {
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${OPENROUTER_KEY}` },
    })
    if (!r.ok) return []
    const data = await r.json()
    return (data.data || [])
      .filter(m => { const p = m.pricing?.prompt; return p === '0' || p === 0 || p === '0.0' || Number(p) === 0 })
      // Capability, not context length — see modelScore. Writing valid Arabic
      // quiz JSON is exactly the task a small or specialist model fails at,
      // and this list was ordered by the one property unrelated to it.
      .sort((a, b) => modelScore(b) - modelScore(a))
      .map(m => m.id).slice(0, 8)
  } catch { return [] }
}

async function callOpenRouter(subject, count, source, grounding) {
  const freeModels = await getFreeModels()
  if (freeModels.length === 0) throw new Error('no free models')
  const msgs = [{ role: 'system', content: buildQuizSystem(subject, grounding) }, { role: 'user', content: quizAsk(subject, count, source) }]
  for (const model of freeModels.slice(0, 5)) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_KEY}`, 'HTTP-Referer': 'https://seu-hulool.vercel.app', 'X-Title': 'SEU Hulool' },
        body: JSON.stringify({ model, messages: msgs, max_tokens: quizTokens(count) }),
      })
      const data = await r.json()
      if (!r.ok) continue
      const quiz = parseQuiz(data.choices?.[0]?.message?.content || '')
      if (quiz) return quiz
    } catch { continue }
  }
  throw new Error('OpenRouter all failed')
}

async function callGroq(subject, count, source, grounding) {
  // No hardcoded names — see src/lib/groq-model.js. Groq decommissions
  // models on its own schedule, and a name written into the source is a
  // time bomb with the fuse set by someone else.
  const text = await groqChat(GROQ_SET, [
    { role: 'system', content: buildQuizSystem(subject, grounding) },
    { role: 'user', content: quizAsk(subject, count, source) },
  ], { max_tokens: quizTokens(count), temperature: 0.7 })
  return parseQuiz(text || '')
}

async function callGemini(subject, count, source, grounding) {
  const body = {
    system_instruction: { parts: [{ text: buildQuizSystem(subject, grounding) }] },
    contents: [{ role: 'user', parts: [{ text: quizAsk(subject, count, source) }] }],
    generationConfig: { maxOutputTokens: quizTokens(count), temperature: 0.7 },
  }
  // Self-healing name, exactly as in the chat route: a retired model answers
  // 404 and geminiGenerate then asks Google what this key can call today.
  return parseQuiz(await geminiGenerate(GEMINI_SET, body) || '')
}

export async function POST(request) {
  // 1) Public site (no accounts) — anonymous callers are served, but every
  // caller is rate limited by IP below since this hits paid providers.
  const caller = callerKey(request)
  // One clock for the WHOLE request, not just the providers.
  const clock = budget()

  // 2) Parse + validate body
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'صيغة الطلب غير صحيحة' }, { status: 400 })
  }
  if (!body.subject || typeof body.subject !== 'string' || body.subject.length > 200) {
    return Response.json({ error: 'مادة غير صحيحة' }, { status: 400 })
  }
  const subject = resolveSubject(body.subject)
  // Free text from a number field, so it can arrive as "", "abc", 0, -4 or
  // 500. Unclamped, that is either a request that produces nothing or one
  // asking a provider for hundreds of questions.
  const count = clampQuestions(body.count)
  const source = resolveSource(body.source)

  const { deviceId, setCookie } = deviceIdentity(request)

  /**
   * One round, not six. Same fault as the chat route: the limiters, the
   * session, the subscription, the file lookup and the paid-quota check all
   * ran in sequence with no clock, so a quiz spent tens of seconds before a
   * provider was asked anything — and then the provider loop started its own
   * budget on top, past the platform's limit. See the long note in
   * src/app/api/ai/route.js.
   */
  const soft = (p, ms, fallback) =>
    withDeadline(Promise.resolve(p), ms).catch(() => fallback)

  const [minuteCheck, dayCheck, userId, subscribed, paidExhausted, groundingResult] =
    await Promise.all([
      soft(aiPerMinuteLimit.limit(caller), 3000, { success: true, reset: Date.now() }),
      soft(aiDailyLimit.limit(caller), 3000, { success: true, reset: Date.now() }),
      soft((async () => {
        try {
          const supabase = await createClient()
          const { data: { user } } = await supabase.auth.getUser()
          return user?.id || null
        } catch { return null }
      })(), 3000, null),
      soft(isSubscribed(deviceId), 3000, false),
      soft(paidQuotaExhausted(request, deviceId), 3000, true),
      soft(contextFor(subject, QUIZ_SOURCES[source]?.ask || subject, { maxChars: 8000 }),
        5000, { context: '', sources: [], hasFiles: false, indexed: 0 }),
    ])

  // 3) Rate limit — per caller IP, since there are no accounts
  if (!minuteCheck.success) {
    return Response.json(
      { error: 'الرجاء الانتظار قليلاً قبل إرسال طلب آخر', retry_after: Math.ceil((minuteCheck.reset - Date.now()) / 1000) },
      { status: 429 }
    )
  }
  if (!dayCheck.success) {
    return Response.json(
      { error: 'لقد استنفدت رصيدك اليومي من المساعد الذكي', reset_at: new Date(dayCheck.reset).toISOString() },
      { status: 429 }
    )
  }

  // ── One free quiz per person ────────────────────────────────────────
  // The owner's rule: everyone gets exactly one, then it is a subscription.
  // Keyed on the account when there is one and the signed device cookie
  // otherwise — the same key the points balance uses, so signing up after
  // spending the trial anonymously does not hand out a second one.
  const owner = ownerKey({ userId, deviceId })

  const replyWith = (obj, status = 200) => {
    const res = Response.json(obj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  /**
   * The course's own files — read BEFORE anything is spent.
   *
   * This used to sit after the trial claim, and that order is what made the
   * quiz «ما يشتغل». «التجميعات المرفقة» and «التلخيص» name uploaded material
   * by definition, so a course with none was refused outright — but the free
   * quiz had already been claimed on the way in. The student was told the
   * quiz could not be built, and then, on the next attempt, that they had
   * used their one free turn. Half the trials on the live table were spent
   * exactly that way, on courses that hold no indexed file at all.
   *
   * So the material is looked at first, and what it turns out to be changes
   * how the quiz is built rather than whether there is one.
   */
  const wantsFiles = source === 'collections' || source === 'summary'
  const grounding = groundingResult

  /**
   * No files is not a dead end — it is a different quiz, said out loud.
   *
   * Refusing was defensible while the promise was «أسئلة من التجميعات»: better
   * an honest no than questions invented and labelled as coming from files.
   * But a student who asks for a quiz and gets a wall has no route forward,
   * and the fix keeps the honesty without the wall — the questions are built
   * from the course itself, and `note` says so on the screen. What is never
   * done is claiming they came from attached material.
   */
  let effectiveSource = source
  let note = ''
  if (wantsFiles && !grounding.context) {
    effectiveSource = 'curriculum'
    note = grounding.hasFiles
      ? 'ملفات هذه المادة مرفوعة لكن لم يُستخرج منها نصّ بعد — بُني الاختبار من محتوى المقرر نفسه.'
      : 'لا توجد ملفات مرفوعة لهذه المادة، فبُني الاختبار من محتوى المقرر نفسه.'
  }

  // Remembered so a turn that produces nothing can be handed back below.
  let db = null
  let claimedNow = false
  if (!subscribed) {
    try { db = createAdminClient() } catch { /* unconfigured */ }
    if (db) {
      // Claimed in one statement. Two quizzes started together would
      // otherwise both read "no row" and both proceed.
      const { data: claimed, error } = await db.rpc('claim_quiz_trial', {
        p_owner: owner, p_subject: subject, p_source: source, p_questions: count,
      })
      // A database that cannot answer must not become a free pass, but it must
      // not lock out a paying student either: the error is reported rather
      // than silently allowing or silently refusing.
      if (error) return replyWith({ error: 'تعذّر التحقق من رصيدك — حاول بعد قليل.' }, 503)
      if (claimed === false) {
        return replyWith({
          error: 'استخدمت اختبارك التجريبي المجاني. اشترك للاختبارات غير المحدودة.',
          need: 'subscription',
          trialUsed: true,
        }, 402)
      }
      claimedNow = claimed === true
    }
  }

  /** Hand the free quiz back when this request produced no quiz. */
  const releaseTrial = async () => {
    if (!claimedNow || !db) return
    claimedNow = false
    try { await db.rpc('release_quiz_trial', { p_owner: owner }) } catch { /* best effort */ }
  }

  // Providers FREE FIRST — paid Anthropic only when this visitor still has
  // paid allowance left today, and only a successful paid reply spends it.
  const providers = []
  // Gemini BEFORE Groq, and the order is about Arabic, not speed.
  //
  // Groq is the fastest thing here by a wide margin, and it was first for
  // that reason alone. But it serves Llama models, whose Arabic is visibly
  // weaker than Gemini's — so the moment a Groq key was added, every answer
  // started arriving fastest and worst, and the owner's verdict was «رجع أخس
  // بكثير». Speed is not the quality a student reads.
  //
  // So Gemini answers, and Groq is what catches the fall when Gemini's free
  // quota runs out — which is far better than the OpenRouter free catalogue
  // that used to catch it.
  if (GEMINI_SET.length > 0)
    providers.push({ name: 'Gemini', paid: false, fn: () => callGemini(subject, count, effectiveSource, grounding) })
  if (GROQ_SET.length > 0)
    providers.push({ name: 'Groq', paid: false, fn: () => callGroq(subject, count, effectiveSource, grounding) })
  if (OPENROUTER_SET.length > 0)
    providers.push({ name: 'OpenRouter', paid: false, fn: () => callOpenRouter(subject, count, effectiveSource, grounding) })
  if (ANTHROPIC_SET.length > 0 && !paidExhausted)
    providers.push({ name: 'Anthropic', paid: true, fn: () => callAnthropic(subject, count, effectiveSource, grounding) })

  const reply = (bodyObj, status = 200) => {
    const res = Response.json(bodyObj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  if (providers.length === 0) {
    await releaseTrial()
    return reply({ error: 'المساعد الذكي غير مفعّل' }, 503)
  }

  const errors = []
  for (let i = 0; i < providers.length; i++) {
    const { name, paid, fn } = providers[i]
    if (i > 0 && !clock.canTry()) break
    if (!isUsable(name)) {
      errors.push(`${name}: skipped — cooling down ${cooldownLeft(name)}s`)
      continue
    }
    try {
      const raw = await withDeadline(fn(), clock.next(providers.length - i))
      noteSuccess(name)
      // Valid JSON is not a valid quiz. See sanitiseQuiz: an answer index
      // outside the options makes a question nobody can get right, and the
      // route used to hand it straight to the student.
      const { quiz, reason } = sanitiseQuiz(raw, count)
      if (quiz.length > 0) {
        if (paid) await consumePaidQuota(request, deviceId)
        return reply(note ? { quiz, note } : { quiz })
      }
      if (reason) errors.push(`${name}: ${reason}`)
    } catch (err) {
      noteFailure(name, err.message)
      errors.push(`${name}: ${err.message}`)
    }
  }

  // Nothing was delivered, so nothing was owed: the free quiz goes back.
  await releaseTrial()
  // Why every provider failed, for the server log — a student gets the
  // apology, not the diagnosis.
  if (errors.length) console.error('[api/ai-quiz] no usable quiz:', errors.join(' | '))
  // Same sentence, same safety rule — see src/lib/provider-errors.js.
  const why = explainFailure(errors)
  return reply({ error: why.error, kind: why.kind }, 500)
}
