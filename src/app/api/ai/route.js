import { aiPerMinuteLimit, aiDailyLimit, callerKey } from '@/lib/rate-limit'
import { deviceIdentity, paidQuotaExhausted, consumePaidQuota, PAID_DAILY_LIMIT } from '@/lib/ai-quota'
import { readUsage, spendPoints, isSubscribed, looksLikeEmail, readPointsConfig } from '@/lib/ai-usage'
import { ownerKey, costOf } from '@/lib/ai-points'
import { createClient } from '@/lib/supabase/server'
import { scopeRules, resolveSubject } from '@/lib/ai-scope'

export const runtime = 'nodejs'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.OpenRouter

async function callAnthropic(subject, messages, fileContext) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY })
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: buildSystem(subject, fileContext),
    messages,
  })
  const text = res.content[0]?.text
  if (!text) throw new Error('empty response')
  return text
}

async function getFreeModels() {
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${OPENROUTER_KEY}` },
    })
    if (!r.ok) return []
    const data = await r.json()
    return (data.data || [])
      .filter(m => {
        const p = m.pricing?.prompt
        return p === '0' || p === 0 || p === '0.0' || Number(p) === 0
      })
      .sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
      .map(m => m.id)
      .slice(0, 8)
  } catch {
    return []
  }
}

async function callOpenRouter(subject, messages, fileContext) {
  const freeModels = await getFreeModels()
  if (freeModels.length === 0) throw new Error('no free models found on OpenRouter')

  // Try multi-model fallback with first 3
  if (freeModels.length >= 3) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': 'https://seu-hulool.vercel.app',
          'X-Title': 'SEU Hulool',
        },
        body: JSON.stringify({
          models: freeModels.slice(0, 3),
          route: 'fallback',
          messages: [{ role: 'system', content: buildSystem(subject, fileContext) }, ...messages],
          max_tokens: 1024,
        }),
      })
      const data = await r.json()
      if (r.ok && data.choices?.[0]?.message?.content)
        return data.choices[0].message.content
    } catch {}
  }

  // Fallback: try each model individually
  const errors = []
  for (const model of freeModels) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': 'https://seu-hulool.vercel.app',
          'X-Title': 'SEU Hulool',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: buildSystem(subject, fileContext) }, ...messages],
          max_tokens: 1024,
        }),
      })
      const data = await r.json()
      if (!r.ok) { errors.push(`${model}: ${data.error?.message}`); continue }
      const text = data.choices?.[0]?.message?.content
      if (text) return text
    } catch (e) { errors.push(`${model}: ${e.message}`) }
  }
  throw new Error(`OpenRouter all failed (${freeModels.length} models tried): ${errors.slice(0, 3).join('; ')}`)
}

async function callGroq(subject, messages, fileContext) {
  // try multiple models in sequence
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192']
  for (const model of models) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: buildSystem(subject, fileContext) },
            ...messages,
          ],
          max_tokens: 1024,
          temperature: 0.7,
        }),
      })
      const data = await r.json()
      if (!r.ok) continue
      const text = data.choices?.[0]?.message?.content
      if (text) return text
    } catch { continue }
  }
  throw new Error('all Groq models failed')
}

async function callGemini(subject, messages, fileContext) {
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))
  const lastMsg = messages[messages.length - 1].content
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`
  const body = {
    system_instruction: { parts: [{ text: buildSystem(subject, fileContext) }] },
    contents: [...history, { role: 'user', parts: [{ text: lastMsg }] }],
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error?.message || 'Gemini error')
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('empty response from Gemini')
  return text
}

function buildSystem(subject, fileContext) {
  // The boundary lives in one place, shared with the quiz route: "عام" is a
  // university-wide assistant, not a general-purpose one.
  let sys = `${scopeRules(subject)}

مهمتك مساعدة الطلاب في: شرح المفاهيم، تلخيص الوحدات، حل الأسئلة، وتقديم نصائح دراسية.
قواعد:
- أجب دائماً باللغة العربية الفصيحة البسيطة
- كن موجزاً ودقيقاً ومفيداً
- استخدم النقاط والعناوين (##) لتنظيم الإجابة عند الحاجة`
  if (fileContext) {
    sys += `\n\n${fileContext}
عند الإجابة: استند إلى هذه الملفات عند الإمكان، وأشر إلى اسم الملف المصدر.
إذا سأل الطالب عن ملف معين، اشرح محتواه أو وجّهه لتحميله.`
  }
  return sys
}

export async function POST(request) {
  // 1) The site is public (no accounts), so this endpoint serves anonymous
  // visitors. It still calls paid providers, so every caller is rate limited
  // by IP below — that budget is the only thing standing between the site and
  // provider abuse, so keep it in place.
  const caller = callerKey(request)

  // 2) Parse + validate body
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'صيغة الطلب غير صحيحة' }, { status: 400 })
  }
  const { messages, fileContext } = body

  if (!body.subject || typeof body.subject !== 'string' || body.subject.length > 200) {
    return Response.json({ error: 'مادة غير صحيحة' }, { status: 400 })
  }
  // Resolved against the catalogue, never used as sent: the subject is
  // interpolated into the system prompt, so a free string is a steering wheel.
  const subject = resolveSubject(body.subject)
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    return Response.json({ error: 'الرسائل غير صحيحة' }, { status: 400 })
  }
  for (const m of messages) {
    if (!['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 4000) {
      return Response.json({ error: 'محتوى رسالة غير صحيح' }, { status: 400 })
    }
  }
  if (fileContext && (typeof fileContext !== 'string' || fileContext.length > 8000)) {
    return Response.json({ error: 'سياق الملف غير صحيح' }, { status: 400 })
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

  const { deviceId, setCookie } = deviceIdentity(request)

  // Every response from here must carry the device cookie when one was
  // freshly minted, or the next request starts a brand-new allowance.
  const reply = (obj, status = 200) => {
    const res = Response.json(obj, { status })
    if (setCookie) res.headers.append('Set-Cookie', setCookie)
    return res
  }

  // 3b) An email identifies who is asking. It is a product gate, not proof of
  // anything — we cannot verify an address here — so it is checked for shape
  // and recorded, and that is all it claims to be.
  if (!looksLikeEmail(body.email)) {
    return reply({ error: 'أدخل بريدك الإلكتروني للمتابعة', need: 'email' }, 400)
  }

  // 3c) The allowance the student actually sees. Subscribers skip it. Checked
  // here, on the server, against the signed device cookie — the client is
  // told the numbers only so it can display them.
  // The balance belongs to the account when there is one, and only falls back
  // to the device otherwise. That is the difference between an allowance that
  // follows the person and one that resets on every new phone.
  let userId = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id || null
  } catch { /* no session — the device key stands in */ }

  const points = await readPointsConfig()
  const owner = ownerKey({ userId, deviceId })

  // What this particular question costs. An image is more to read and more to
  // answer, so it is not priced the same as a line of text. Read from the
  // request rather than assumed: the attachment UI lands next, and pricing
  // that ignores what was actually sent is pricing that will be wrong the day
  // it does.
  const hasImage = Boolean(body.image) ||
    (Array.isArray(body.messages) && body.messages.some(m => m && m.image))
  const cost = costOf(hasImage ? 'image' : 'message', points)

  const subscribed = await isSubscribed(deviceId)
  if (!subscribed) {
    const usage = await readUsage(owner, points.free)
    if (usage.remaining < cost) {
      return reply({
        error: usage.remaining <= 0
          ? `انتهت نقاطك (${points.free}). انتظر حتى تتجدّد أو اطلب اشتراكاً.`
          : `يتبقّى لك ${usage.remaining} نقطة، وهذا السؤال يحتاج ${cost}.`,
        need: 'subscription',
        limit: points.free,
        cost,
        used: usage.used,
        remaining: usage.remaining,
        resetAt: usage.resetAt,
      }, 429)
    }
  }

  // 4) Providers, FREE FIRST. Paid Anthropic is only appended when this
  // visitor still has paid allowance left today, so ordinary use costs
  // nothing and the paid key is a quality fallback rather than the default.
  const providers = []
  if (GROQ_KEY && !GROQ_KEY.includes('placeholder'))
    providers.push({ name: 'Groq', paid: false, fn: () => callGroq(subject, messages, fileContext) })
  if (GEMINI_KEY && !GEMINI_KEY.includes('placeholder') && GEMINI_KEY.length > 20)
    providers.push({ name: 'Gemini', paid: false, fn: () => callGemini(subject, messages, fileContext) })
  if (OPENROUTER_KEY && !OPENROUTER_KEY.includes('placeholder'))
    providers.push({ name: 'OpenRouter', paid: false, fn: () => callOpenRouter(subject, messages, fileContext) })

  let paidAllowed = false
  if (ANTHROPIC_KEY && !ANTHROPIC_KEY.includes('placeholder')) {
    paidAllowed = !(await paidQuotaExhausted(request, deviceId))
    if (paidAllowed) {
      providers.push({ name: 'Anthropic', paid: true, fn: () => callAnthropic(subject, messages, fileContext) })
    }
  }

  if (providers.length === 0) {
    // Either nothing is configured, or only the paid key is and it is spent.
    if (paidAllowed === false && ANTHROPIC_KEY && !ANTHROPIC_KEY.includes('placeholder')) {
      return reply({
        error: `استهلكت رصيدك اليومي من المساعد الذكي (${PAID_DAILY_LIMIT} رسائل). جرّب غداً.`,
      }, 429)
    }
    return reply({
      text: `المساعد الذكي غير مفعّل بعد.\n\nللتفعيل المجاني:\n١. افتح openrouter.ai\n٢. سجّل دخولك بحساب Google\n٣. اضغط "Keys" ← "Create Key"\n٤. أضف OPENROUTER_API_KEY في Vercel → Settings → Environment Variables`,
    })
  }

  // try each provider in turn — return first success
  const errors = []
  for (const { name, paid, fn } of providers) {
    try {
      const text = await fn()
      if (text) {
        // Only a successful paid reply spends the provider budget; free ones
        // never do. The student's own allowance is spent on any answered
        // question, free or paid, but never on a failure.
        if (paid) await consumePaidQuota(request, deviceId)
        const usage = subscribed ? null : await spendPoints(owner, cost, points.free)
        return reply({
          text,
          subscribed,
          limit: points.free,
          cost,
          ...(usage ? { used: usage.used, remaining: usage.remaining, resetAt: usage.resetAt } : {}),
        })
      }
    } catch (err) {
      errors.push(`${name}: ${err.message}`)
    }
  }

  console.error('[api/ai] all providers failed:', errors.join(' | '))
  return reply(
    { error: `عذراً، المساعد الذكي غير متاح الآن. جرّب مجدداً بعد دقيقة.` },
    500
  )
}
