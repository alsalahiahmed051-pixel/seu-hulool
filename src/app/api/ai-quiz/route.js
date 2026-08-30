import { aiPerMinuteLimit, aiDailyLimit, callerKey } from '@/lib/rate-limit'
import { deviceIdentity, paidQuotaExhausted, consumePaidQuota } from '@/lib/ai-quota'
import { quizScope, isGeneral } from '@/lib/ai-scope'

export const runtime = 'nodejs'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.OpenRouter

function buildQuizSystem(subject) {
  return `أنت مساعد اختبارات لطلاب الجامعة السعودية الإلكترونية (SEU).
${quizScope(subject)}

أعد JSON فقط بهذا الشكل: [{"q":"السؤال","options":["أ","ب","ج","د"],"answer":0}]. لا تكتب أي نص خارج JSON.`
}

/** What we ask for — the general assistant must not produce trivia. */
function quizAsk(subject) {
  return isGeneral(subject)
    ? 'أنشئ 5 أسئلة اختيار من متعدد لطلاب الجامعة السعودية الإلكترونية عن الدراسة الجامعية وأنظمتها ومهارات المذاكرة'
    : `أنشئ 5 أسئلة اختيار من متعدد عن مادة "${subject}"`
}

function parseQuiz(text) {
  try { return JSON.parse(text.trim()) } catch {}
  const m = text.match(/\[[\s\S]*\]/)
  if (m) { try { return JSON.parse(m[0]) } catch {} }
  return null
}

async function callAnthropic(subject) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY })
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: buildQuizSystem(subject),
    messages: [{ role: 'user', content: quizAsk(subject) }],
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
      .sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
      .map(m => m.id).slice(0, 8)
  } catch { return [] }
}

async function callOpenRouter(subject) {
  const freeModels = await getFreeModels()
  if (freeModels.length === 0) throw new Error('no free models')
  const msgs = [{ role: 'system', content: buildQuizSystem(subject) }, { role: 'user', content: quizAsk(subject) }]
  for (const model of freeModels.slice(0, 5)) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_KEY}`, 'HTTP-Referer': 'https://seu-hulool.vercel.app', 'X-Title': 'SEU Hulool' },
        body: JSON.stringify({ model, messages: msgs, max_tokens: 1024 }),
      })
      const data = await r.json()
      if (!r.ok) continue
      const quiz = parseQuiz(data.choices?.[0]?.message?.content || '')
      if (quiz) return quiz
    } catch { continue }
  }
  throw new Error('OpenRouter all failed')
}

async function callGroq(subject) {
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192']
  const msgs = [{ role: 'system', content: buildQuizSystem(subject) }, { role: 'user', content: quizAsk(subject) }]
  for (const model of models) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model, messages: msgs, max_tokens: 1024, temperature: 0.7 }),
      })
      const data = await r.json()
      if (!r.ok) continue
      const quiz = parseQuiz(data.choices?.[0]?.message?.content || '')
      if (quiz) return quiz
    } catch { continue }
  }
  throw new Error('all Groq models failed')
}

async function callGemini(subject) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`
  const body = {
    system_instruction: { parts: [{ text: buildQuizSystem(subject) }] },
    contents: [{ role: 'user', parts: [{ text: quizAsk(subject) }] }],
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  }
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error?.message || 'Gemini error')
  return parseQuiz(data.candidates?.[0]?.content?.parts?.[0]?.text || '')
}

export async function POST(request) {
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
  const { subject } = body
  if (!subject || typeof subject !== 'string' || subject.length > 200) {
    return Response.json({ error: 'مادة غير صحيحة' }, { status: 400 })
  }

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

  // Providers FREE FIRST — paid Anthropic only when this visitor still has
  // paid allowance left today, and only a successful paid reply spends it.
  const { deviceId, setCookie } = deviceIdentity(request)
  const providers = []
  if (GROQ_KEY && !GROQ_KEY.includes('placeholder'))
    providers.push({ name: 'Groq', paid: false, fn: () => callGroq(subject) })
  if (GEMINI_KEY && !GEMINI_KEY.includes('placeholder') && GEMINI_KEY.length > 20)
    providers.push({ name: 'Gemini', paid: false, fn: () => callGemini(subject) })
  if (OPENROUTER_KEY && !OPENROUTER_KEY.includes('placeholder'))
    providers.push({ name: 'OpenRouter', paid: false, fn: () => callOpenRouter(subject) })
  if (ANTHROPIC_KEY && !ANTHROPIC_KEY.includes('placeholder') && !(await paidQuotaExhausted(request, deviceId)))
    providers.push({ name: 'Anthropic', paid: true, fn: () => callAnthropic(subject) })

  const reply = (bodyObj, status = 200) => {
    const res = Response.json(bodyObj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  if (providers.length === 0) {
    return reply({ error: 'المساعد الذكي غير مفعّل' }, 503)
  }

  for (const { paid, fn } of providers) {
    try {
      const quiz = await fn()
      if (quiz && Array.isArray(quiz) && quiz.length > 0) {
        if (paid) await consumePaidQuota(request, deviceId)
        return reply({ quiz })
      }
    } catch {}
  }

  return reply({ error: 'تعذّر توليد الاختبار، جرّب مجدداً' }, 500)
}
