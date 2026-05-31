export const runtime = 'nodejs'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY

async function callAnthropic(subject, messages) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY })
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: buildSystem(subject),
    messages,
  })
  const text = res.content[0]?.text
  if (!text) throw new Error('empty response')
  return text
}

async function callOpenRouter(subject, messages) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': 'https://seu-hulool.vercel.app',
      'X-Title': 'SEU Hulool',
    },
    body: JSON.stringify({
      models: [
        'meta-llama/llama-3.3-70b-instruct:free',
        'deepseek/deepseek-chat-v3-0324:free',
        'google/gemma-3-27b-it:free',
      ],
      route: 'fallback',
      messages: [
        { role: 'system', content: buildSystem(subject) },
        ...messages,
      ],
      max_tokens: 1024,
    }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error?.message || 'OpenRouter error')
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('empty response from OpenRouter')
  return text
}

async function callGroq(subject, messages) {
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
            { role: 'system', content: buildSystem(subject) },
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

async function callGemini(subject, messages) {
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))
  const lastMsg = messages[messages.length - 1].content
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`
  const body = {
    system_instruction: { parts: [{ text: buildSystem(subject) }] },
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

function buildSystem(subject) {
  return `أنت مساعد أكاديمي ذكي متخصص في مادة "${subject}" بالجامعة السعودية الإلكترونية (SEU).
مهمتك مساعدة الطلاب في: شرح المفاهيم، تلخيص الوحدات، حل الأسئلة، وتقديم نصائح دراسية.
قواعد:
- أجب دائماً باللغة العربية الفصيحة البسيطة
- كن موجزاً ودقيقاً ومفيداً
- استخدم النقاط والعناوين لتنظيم الإجابة عند الحاجة
- إذا سُئلت عن موضوع خارج المادة فوجّه الطالب بلطف`
}

export async function POST(request) {
  const { subject, messages } = await request.json()

  const providers = []
  if (ANTHROPIC_KEY && !ANTHROPIC_KEY.includes('placeholder'))
    providers.push({ name: 'Anthropic', fn: () => callAnthropic(subject, messages) })
  if (OPENROUTER_KEY && !OPENROUTER_KEY.includes('placeholder'))
    providers.push({ name: 'OpenRouter', fn: () => callOpenRouter(subject, messages) })
  if (GROQ_KEY && !GROQ_KEY.includes('placeholder'))
    providers.push({ name: 'Groq', fn: () => callGroq(subject, messages) })
  if (GEMINI_KEY && !GEMINI_KEY.includes('placeholder') && GEMINI_KEY.length > 20)
    providers.push({ name: 'Gemini', fn: () => callGemini(subject, messages) })

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
    { error: `عذراً، المساعد الذكي غير متاح الآن. جرّب مجدداً بعد دقيقة.` },
    { status: 500 }
  )
}
