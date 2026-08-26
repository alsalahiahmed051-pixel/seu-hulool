import { createClient } from '@/lib/supabase/server'
import { aiPerMinuteLimit, aiDailyLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.OpenRouter

function buildQuizSystem(subject) {
  return `أنت مساعد اختبارات. أنشئ 5 أسئلة اختيار من متعدد عن مادة "${subject}". أعد JSON فقط بهذا الشكل: [{"q":"السؤال","options":["أ","ب","ج","د"],"answer":0}]. لا تكتب أي نص خارج JSON.`
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
    messages: [{ role: 'user', content: `أنشئ 5 أسئلة اختيار من متعدد عن مادة "${subject}"` }],
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
  const msgs = [{ role: 'system', content: buildQuizSystem(subject) }, { role: 'user', content: `أنشئ 5 أسئلة اختيار من متعدد عن مادة "${subject}"` }]
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
  const msgs = [{ role: 'system', content: buildQuizSystem(subject) }, { role: 'user', content: `أنشئ 5 أسئلة اختيار من متعدد عن مادة "${subject}"` }]
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
    contents: [{ role: 'user', parts: [{ text: `أنشئ 5 أسئلة اختيار من متعدد عن مادة "${subject}"` }] }],
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  }
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error?.message || 'Gemini error')
  return parseQuiz(data.candidates?.[0]?.content?.parts?.[0]?.text || '')
}

export async function POST(request) {
  // 1) Authenticate — this endpoint calls paid third-party AI providers,
  // so it must never be reachable by a logged-out or anonymous caller.
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
  }

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

  // 3) Rate limit — per authenticated user, not per IP
  const minuteCheck = await aiPerMinuteLimit.limit(user.id)
  if (!minuteCheck.success) {
    return Response.json(
      { error: 'الرجاء الانتظار قليلاً قبل إرسال طلب آخر', retry_after: Math.ceil((minuteCheck.reset - Date.now()) / 1000) },
      { status: 429 }
    )
  }
  const dayCheck = await aiDailyLimit.limit(user.id)
  if (!dayCheck.success) {
    return Response.json(
      { error: 'لقد استنفدت رصيدك اليومي من المساعد الذكي', reset_at: new Date(dayCheck.reset).toISOString() },
      { status: 429 }
    )
  }

  const providers = []
  if (ANTHROPIC_KEY && !ANTHROPIC_KEY.includes('placeholder'))
    providers.push({ name: 'Anthropic', fn: () => callAnthropic(subject) })
  if (OPENROUTER_KEY && !OPENROUTER_KEY.includes('placeholder'))
    providers.push({ name: 'OpenRouter', fn: () => callOpenRouter(subject) })
  if (GROQ_KEY && !GROQ_KEY.includes('placeholder'))
    providers.push({ name: 'Groq', fn: () => callGroq(subject) })
  if (GEMINI_KEY && !GEMINI_KEY.includes('placeholder') && GEMINI_KEY.length > 20)
    providers.push({ name: 'Gemini', fn: () => callGemini(subject) })

  if (providers.length === 0) {
    return Response.json({ error: 'المساعد الذكي غير مفعّل' }, { status: 503 })
  }

  for (const { name, fn } of providers) {
    try {
      const quiz = await fn()
      if (quiz && Array.isArray(quiz) && quiz.length > 0) return Response.json({ quiz })
    } catch {}
  }

  return Response.json({ error: 'تعذّر توليد الاختبار، جرّب مجدداً' }, { status: 500 })
}
