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
  let sys = `أنت مساعد أكاديمي ذكي متخصص في مادة "${subject}" بالجامعة السعودية الإلكترونية (SEU).
مهمتك مساعدة الطلاب في: شرح المفاهيم، تلخيص الوحدات، حل الأسئلة، وتقديم نصائح دراسية.
قواعد:
- أجب دائماً باللغة العربية الفصيحة البسيطة
- كن موجزاً ودقيقاً ومفيداً
- استخدم النقاط والعناوين (##) لتنظيم الإجابة عند الحاجة
- إذا سُئلت عن موضوع خارج المادة فوجّه الطالب بلطف`
  if (fileContext) {
    sys += `\n\n${fileContext}
عند الإجابة: استند إلى هذه الملفات عند الإمكان، وأشر إلى اسم الملف المصدر.
إذا سأل الطالب عن ملف معين، اشرح محتواه أو وجّهه لتحميله.`
  }
  return sys
}

export async function POST(request) {
  const { subject, messages, fileContext } = await request.json()

  const providers = []
  if (ANTHROPIC_KEY && !ANTHROPIC_KEY.includes('placeholder'))
    providers.push({ name: 'Anthropic', fn: () => callAnthropic(subject, messages, fileContext) })
  if (OPENROUTER_KEY && !OPENROUTER_KEY.includes('placeholder'))
    providers.push({ name: 'OpenRouter', fn: () => callOpenRouter(subject, messages, fileContext) })
  if (GROQ_KEY && !GROQ_KEY.includes('placeholder'))
    providers.push({ name: 'Groq', fn: () => callGroq(subject, messages, fileContext) })
  if (GEMINI_KEY && !GEMINI_KEY.includes('placeholder') && GEMINI_KEY.length > 20)
    providers.push({ name: 'Gemini', fn: () => callGemini(subject, messages, fileContext) })

  if (providers.length === 0) {
    return Response.json({
      text: `المساعد الذكي غير مفعّل بعد.\n\nللتفعيل المجاني:\n١. افتح openrouter.ai\n٢. سجّل دخولك بحساب Google\n٣. اضغط "Keys" ← "Create Key"\n٤. أضف OPENROUTER_API_KEY في Vercel → Settings → Environment Variables`,
    })
  }

  // try each provider in turn — return first success
  const errors = []
  for (const { name, fn } of providers) {
    try {
      const text = await fn()
      if (text) return Response.json({ text })
    } catch (err) {
      errors.push(`${name}: ${err.message}`)
    }
  }

  return Response.json(
    { error: `عذراً، المساعد الذكي غير متاح الآن. جرّب مجدداً بعد دقيقة.`, _debug: errors },
    { status: 500 }
  )
}
