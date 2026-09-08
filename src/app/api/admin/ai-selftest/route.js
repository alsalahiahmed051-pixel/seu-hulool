import { requireAdmin } from '@/lib/admin-guard'
import { geminiModel } from '@/lib/gemini-model'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Which AI provider is actually answering, and what the others are saying.
 *
 * «عذراً، المساعد الذكي غير متاح الآن» is what the site says when EVERY
 * provider threw. It cannot say more: a student has no use for a provider's
 * error text, and the owner is not in the server log. So the reason lived
 * nowhere he could reach it, and every round of this ended with me guessing
 * from the outside — the same dead end the storage outage ran into, until a
 * self-test replaced the guessing with one screen of facts.
 *
 * This is that screen for the assistant. It asks each configured provider for
 * one short answer and reports, per provider: configured or not, answered or
 * not, how long it took, and the reason if it refused — so «it says تعذّر»
 * becomes «Gemini: quota exceeded, OpenRouter: 402, Groq: not configured».
 *
 * A real request, not a mock: the point is to reproduce what a student's
 * question meets, so it must go the same way and cost the same quota.
 */

const KEYS = {
  Groq: process.env.GROQ_API_KEY,
  Gemini: process.env.GEMINI_API_KEY || process.env.GEMINI,
  OpenRouter: process.env.OPENROUTER_API_KEY || process.env.OpenRouter,
  Anthropic: process.env.ANTHROPIC_API_KEY,
}

/** Short enough that a slow provider is slow for its own reasons, not ours. */
const PROBE = 'قل كلمة واحدة: تم'
const TIMEOUT_MS = 12_000

function usable(key) {
  return !!key && !String(key).includes('placeholder') && String(key).length > 12
}

async function timed(fn) {
  const t0 = Date.now()
  try {
    const text = await fn()
    return { ok: !!text, ms: Date.now() - t0, sample: String(text || '').slice(0, 40) }
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, reason: clean(e) }
  }
}

function withTimeout(url, init) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  return fetch(url, { ...init, signal: ctl.signal }).finally(() => clearTimeout(t))
}

/**
 * An error a person can read, carrying nothing secret.
 *
 * Provider errors quote the request — which for Gemini means the URL with the
 * key in its query string. A diagnosis worth showing is never worth leaking a
 * key for, so the same redaction the storage self-test uses applies here.
 */
function clean(e) {
  return String(e?.message || e || 'error')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/(key|token|api[_-]?key)=\S+/gi, '$1=[محذوف]')
    .replace(/\b[A-Za-z0-9_-]{28,}\b/g, '[محذوف]')
    .slice(0, 160)
}

async function askGroq() {
  const r = await withTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEYS.Groq}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: PROBE }],
      max_tokens: 16,
    }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${d.error?.message || ''}`)
  return d.choices?.[0]?.message?.content
}

async function askGemini() {
  // The same discovery the site uses, so this reports the model a student's
  // question would actually reach — not one this file happens to name.
  const model = await geminiModel(KEYS.Gemini, withTimeout)
  const r = await withTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEYS.Gemini}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: PROBE }] }],
        generationConfig: { maxOutputTokens: 16 },
      }),
    })
  const d = await r.json()
  if (!r.ok) throw new Error(`${model}: HTTP ${r.status} ${d.error?.message || ''}`)
  return d.candidates?.[0]?.content?.parts?.[0]?.text
}

async function askOpenRouter() {
  // The catalogue first, because «no free models» and «the model refused» are
  // different failures with different fixes, and the site cannot tell them
  // apart from the outside.
  const cat = await withTimeout('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${KEYS.OpenRouter}` },
  })
  if (!cat.ok) throw new Error(`قائمة النماذج: HTTP ${cat.status}`)
  const data = await cat.json()
  const free = (data.data || []).filter(m => {
    const p = m.pricing?.prompt
    return p === '0' || p === 0 || p === '0.0' || Number(p) === 0
  })
  if (!free.length) throw new Error('لا نماذج مجانية في القائمة')

  const errors = []
  for (const m of free.slice(0, 4)) {
    const r = await withTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEYS.OpenRouter}`,
        'HTTP-Referer': 'https://seu-hulool.vercel.app',
        'X-Title': 'SEU Hulool',
      },
      body: JSON.stringify({ model: m.id, messages: [{ role: 'user', content: PROBE }], max_tokens: 16 }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { errors.push(`${m.id}: HTTP ${r.status} ${d.error?.message || ''}`); continue }
    const text = d.choices?.[0]?.message?.content
    if (text) return text
    errors.push(`${m.id}: ردٌّ فارغ`)
  }
  throw new Error(errors.join(' · ').slice(0, 200))
}

async function askAnthropic() {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: KEYS.Anthropic })
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16,
    messages: [{ role: 'user', content: PROBE }],
  })
  return res.content[0]?.text
}

const PROVIDERS = [
  { name: 'Groq', paid: false, ask: askGroq, note: 'مجاني وسريع جداً' },
  { name: 'Gemini', paid: false, ask: askGemini, note: 'مجاني، حصّة يومية' },
  { name: 'OpenRouter', paid: false, ask: askOpenRouter, note: 'مجاني، نماذج متغيّرة' },
  { name: 'Anthropic', paid: true, ask: askAnthropic, note: 'مدفوع — احتياطي' },
]

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const results = []
  for (const p of PROVIDERS) {
    if (!usable(KEYS[p.name])) {
      results.push({ name: p.name, paid: p.paid, note: p.note, configured: false, ok: false })
      continue
    }
    const r = await timed(p.ask)
    results.push({ name: p.name, paid: p.paid, note: p.note, configured: true, ...r })
  }

  const working = results.filter(r => r.ok)
  const freeWorking = working.filter(r => !r.paid)
  const configured = results.filter(r => r.configured)

  // The verdict names the next action, not the state: «none configured» and
  // «all configured and all refusing» look identical on the site and need
  // opposite responses from the owner.
  let verdict
  if (!configured.length) {
    verdict = 'لا مفتاح مضبوط أصلاً — أضف مفتاح OpenRouter أو Groq في إعدادات Vercel.'
  } else if (freeWorking.length) {
    const fastest = [...freeWorking].sort((a, b) => a.ms - b.ms)[0]
    verdict = `المساعد يعمل. أسرع مزوّد مجاني: ${fastest.name} (${(fastest.ms / 1000).toFixed(1)}ث).`
  } else if (working.length) {
    verdict = 'المجانيّون كلهم ساقطون، والمدفوع وحده يردّ — لهذا يبدو المساعد متقطّعاً.'
  } else {
    verdict = 'كل مزوّدٍ مضبوط رفض الطلب. السبب مكتوب بجانب كل واحد أدناه.'
  }

  return Response.json({ results, verdict })
}
