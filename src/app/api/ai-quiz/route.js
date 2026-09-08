import { aiPerMinuteLimit, aiDailyLimit, callerKey } from '@/lib/rate-limit'
import { deviceIdentity, paidQuotaExhausted, consumePaidQuota } from '@/lib/ai-quota'
import { quizScope, isGeneral, resolveSubject } from '@/lib/ai-scope'
import { QUIZ_SOURCES, resolveSource, clampQuestions } from '@/lib/quiz-options'
import { isSubscribed } from '@/lib/ai-usage'
import { ownerKey } from '@/lib/ai-points'
import { modelScore } from '@/lib/model-rank'
import { contextFor } from '@/lib/retrieval'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { docScript } from '@/lib/lang'
import { geminiGenerate } from '@/lib/gemini-model'
import { firstAnswer } from '@/lib/hedge'

export const runtime = 'nodejs'

/**
 * The platform's own clock, raised off its default.
 *
 * Unset, a function on this plan is killed at TEN SECONDS. A free model
 * answering a real question with a course's passages under it routinely needs
 * twenty or forty — so the request died mid-generation, and the page showed
 * either an error or nothing at all, at random, depending only on how fast the
 * provider happened to be that minute. It read as «sometimes it works».
 *
 * The indexer has carried this line since it was written; these two never got
 * it, and lived on the edge of the default until answers grew long enough to
 * fall off it.
 */
export const maxDuration = 60

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.OpenRouter

/**
 * The same two clocks as the chat, for the same reason — and a quiz needs them
 * more, not less. Thirty questions of valid JSON is the heaviest thing asked of
 * a free model here, so a stalled attempt is likelier and costs more.
 */
const ATTEMPT_MS = 20_000
const DEADLINE_MS = 45_000

function timedFetch(url, init = {}, ms = ATTEMPT_MS) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  return fetch(url, { ...init, signal: ctl.signal }).finally(() => clearTimeout(t))
}

/** The free-model catalogue, remembered rather than re-fetched every quiz. */
let modelCache = { at: 0, list: [] }
const MODEL_TTL_MS = 60 * 60 * 1000

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

    // A quiz follows the MATERIAL's language, where the chat follows the
    // student's — and the difference is the point of each. A chat answer is
    // read to understand; a quiz question is answered to rehearse. Rehearsing
    // an English-taught course in Arabic trains a student for a paper they
    // will not sit, so here the file decides.
    const docLang = docScript(grounding.context)
    if (docLang === 'en') {
      sys += `
اكتب الأسئلة وخياراتها بالإنجليزية، لأن ملفات هذه المادة بالإنجليزية وورقة الاختبار ستكون بها.`
    } else if (docLang === 'ar') {
      sys += `
اكتب الأسئلة وخياراتها بالعربية، كما وردت المادة في ملفاتها.`
    } else if (docLang === 'mixed') {
      sys += `
ملفات هذه المادة تخلط العربية والإنجليزية: اكتب كل سؤال بلغة المقطع الذي بُني عليه، وأبقِ المصطلحات كما وردت في الملف ولا تترجمها.`
    }
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

function parseQuiz(text) {
  try { return JSON.parse(text.trim()) } catch {}
  const m = text.match(/\[[\s\S]*\]/)
  if (m) { try { return JSON.parse(m[0]) } catch {} }
  return null
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
  if (modelCache.list.length && Date.now() - modelCache.at < MODEL_TTL_MS) return modelCache.list
  try {
    const r = await timedFetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${OPENROUTER_KEY}` },
    }, 6000)
    if (!r.ok) return []
    const data = await r.json()
    const list = (data.data || [])
      .filter(m => { const p = m.pricing?.prompt; return p === '0' || p === 0 || p === '0.0' || Number(p) === 0 })
      // Capability, not context length — see modelScore. Writing valid Arabic
      // quiz JSON is exactly the task a small or specialist model fails at,
      // and this list was ordered by the one property unrelated to it.
      .sort((a, b) => modelScore(b) - modelScore(a))
      // Eight candidates, and the loop below stops on the CLOCK rather than a
      // count: an empty reply costs under a second, so trying more of them is
      // nearly free — and trying too few is how every provider ends up
      // «refusing» on a day when the top of the free catalogue is junk.
      .map(m => m.id).slice(0, 8)
    modelCache = { at: Date.now(), list }
    return list
  } catch { return [] }
}

async function callOpenRouter(subject, count, source, grounding, deadline = Infinity) {
  const freeModels = await getFreeModels()
  if (freeModels.length === 0) throw new Error('no free models')
  const msgs = [{ role: 'system', content: buildQuizSystem(subject, grounding) }, { role: 'user', content: quizAsk(subject, count, source) }]
  for (const model of freeModels) {
    if (Date.now() > deadline) break
    try {
      const r = await timedFetch('https://openrouter.ai/api/v1/chat/completions', {
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
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192']
  const msgs = [{ role: 'system', content: buildQuizSystem(subject, grounding) }, { role: 'user', content: quizAsk(subject, count, source) }]
  for (const model of models) {
    try {
      const r = await timedFetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model, messages: msgs, max_tokens: quizTokens(count), temperature: 0.7 }),
      })
      const data = await r.json()
      if (!r.ok) continue
      const quiz = parseQuiz(data.choices?.[0]?.message?.content || '')
      if (quiz) return quiz
    } catch { continue }
  }
  throw new Error('all Groq models failed')
}

async function callGemini(subject, count, source, grounding) {
  const body = {
    system_instruction: { parts: [{ text: buildQuizSystem(subject, grounding) }] },
    contents: [{ role: 'user', parts: [{ text: quizAsk(subject, count, source) }] }],
    generationConfig: { maxOutputTokens: quizTokens(count), temperature: 0.7 },
  }
  // One request when the name is right; the catalogue only when Google says
  // the NAME is what it objects to. See lib/gemini-model.
  return parseQuiz(await geminiGenerate(GEMINI_KEY, body, timedFetch))
}

export async function POST(request) {
  const started = Date.now()
  // 1) Public site (no accounts) — anonymous callers are served, but every
  // caller is rate limited by IP below since this hits paid providers.
  const caller = callerKey(request)

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

  // 3) Rate limit — per caller IP, since there are no accounts
  const minuteCheck = await aiPerMinuteLimit.limit(caller)
  if (!minuteCheck.success) {
    return Response.json(
      { error: 'الرجاء الانتظار قليلاً قبل إرسال طلب آخر', retry_after: Math.ceil((minuteCheck.reset - Date.now()) / 1000) },
      { status: 429 }
    )
  }
  const dayCheck = await aiDailyLimit.limit(caller)
  if (!dayCheck.success) {
    return Response.json(
      { error: 'لقد استنفدت رصيدك اليومي من المساعد الذكي', reset_at: new Date(dayCheck.reset).toISOString() },
      { status: 429 }
    )
  }

  const { deviceId, setCookie } = deviceIdentity(request)

  // ── One free quiz per person ────────────────────────────────────────
  // The owner's rule: everyone gets exactly one, then it is a subscription.
  // Keyed on the account when there is one and the signed device cookie
  // otherwise — the same key the points balance uses, so signing up after
  // spending the trial anonymously does not hand out a second one.
  let userId = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id || null
  } catch { /* no session — the device key stands in */ }
  const owner = ownerKey({ userId, deviceId })

  const replyWith = (obj, status = 200) => {
    const res = Response.json(obj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  const subscribed = await isSubscribed(deviceId)
  if (!subscribed) {
    let db = null
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
    }
  }

  /**
   * The course's own files, for the sources that promise them.
   *
   * «التجميعات المرفقة» and «التلخيص» name uploaded material by definition, so
   * when the course has none the honest answer is to say so — not to generate
   * questions out of nothing and label them as coming from the collections.
   */
  const wantsFiles = source === 'collections' || source === 'summary'
  let grounding = { context: '', sources: [], hasFiles: false, indexed: 0 }
  try {
    grounding = await contextFor(subject, QUIZ_SOURCES[source]?.ask || subject, { maxChars: 8000 })
  } catch { /* fall through ungrounded */ }

  if (wantsFiles && !grounding.context) {
    return replyWith({
      error: grounding.hasFiles
        ? 'ملفات هذه المادة مرفوعة لكن لم يُستخرج منها نصّ قابل للقراءة بعد — جرّب «المقرر الدراسي» أو «عشوائي من كل شيء».'
        : 'لا توجد ملفات مرفوعة لهذه المادة بعد، فلا يمكن بناء اختبار منها — جرّب «المقرر الدراسي» أو «عشوائي من كل شيء».',
      need: 'files',
    }, 409)
  }

  // Providers FREE FIRST — paid Anthropic only when this visitor still has
  // paid allowance left today, and only a successful paid reply spends it.
  const providers = []
  if (GROQ_KEY && !GROQ_KEY.includes('placeholder'))
    providers.push({ name: 'Groq', paid: false, fn: () => callGroq(subject, count, source, grounding) })
  if (GEMINI_KEY && !GEMINI_KEY.includes('placeholder') && GEMINI_KEY.length > 20)
    providers.push({ name: 'Gemini', paid: false, fn: () => callGemini(subject, count, source, grounding) })
  if (OPENROUTER_KEY && !OPENROUTER_KEY.includes('placeholder'))
    providers.push({ name: 'OpenRouter', paid: false, fn: () => callOpenRouter(subject, count, source, grounding, started + DEADLINE_MS) })
  if (ANTHROPIC_KEY && !ANTHROPIC_KEY.includes('placeholder') && !(await paidQuotaExhausted(request, deviceId)))
    providers.push({ name: 'Anthropic', paid: true, fn: () => callAnthropic(subject, count, source, grounding) })

  const reply = (bodyObj, status = 200) => {
    const res = Response.json(bodyObj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  if (providers.length === 0) {
    return reply({ error: 'المساعد الذكي غير مفعّل' }, 503)
  }

  // Free providers race with a head start, exactly as the chat does — a quiz
  // used to wait out each provider's full timeout in turn, which is why
  // «تعذّر توليد الاختبار» arrived after most of a minute.
  const errors = []
  const isQuiz = (q) => Array.isArray(q) && q.length > 0
  const free = providers.filter(p => !p.paid)
  const paidProviders = providers.filter(p => p.paid)
  let won = free.length ? await firstAnswer(free, errors, { isGood: isQuiz }) : null

  // The paid one never races: it is the only provider that costs money.
  if (!won) {
    for (const p of paidProviders) {
      if (Date.now() - started > DEADLINE_MS) { errors.push(`${p.name}: نفد الوقت`); break }
      try {
        const quiz = await p.fn()
        if (isQuiz(quiz)) { won = { provider: p, value: quiz }; break }
        errors.push(`${p.name}: ردٌّ فارغ`)
      } catch (err) {
        errors.push(`${p.name}: ${err.message}`)
      }
    }
  }

  if (won) {
    if (won.provider.paid) await consumePaidQuota(request, deviceId)
    return reply({ quiz: won.value })
  }

  // The reasons used to be swallowed by `catch {}`, so a failing quiz left no
  // trace anywhere — not in the reply, not in the log. The student still sees
  // only the apology; the owner now has something to act on.
  console.error('[api/ai-quiz] all providers failed:', errors.join(' | '))
  return reply({ error: 'تعذّر توليد الاختبار، جرّب مجدداً' }, 500)
}
