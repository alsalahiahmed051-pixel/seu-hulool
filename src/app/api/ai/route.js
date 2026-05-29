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
  return res.content[0]?.text
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
        'google/gemma-2-9b-it:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen-2.5-7b-instruct:free',
        'mistralai/mistral-7b-instruct:free',
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
  return data.choices?.[0]?.message?.content
}

async function callGroq(subject, messages) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: buildSystem(subject) },
        ...messages,
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error?.message || 'Groq error')
  return data.choices?.[0]?.message?.content
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
  return data.candidates?.[0]?.content?.parts?.[0]?.text
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

  const hasAnthropic = ANTHROPIC_KEY && !ANTHROPIC_KEY.includes('placeholder')
  const hasOpenRouter = OPENROUTER_KEY && !OPENROUTER_KEY.includes('placeholder')
  const hasGroq = GROQ_KEY && !GROQ_KEY.includes('placeholder')
  const hasGemini = GEMINI_KEY && !GEMINI_KEY.includes('placeholder')

  if (!hasAnthropic && !hasOpenRouter && !hasGroq && !hasGemini) {
    return Response.json({
      text: `المساعد الذكي غير مفعّل بعد.\n\nللتفعيل المجاني:\n١. افتح openrouter.ai\n٢. سجّل دخولك بحساب Google\n٣. اضغط "Keys" ← "Create Key"\n٤. أضف OPENROUTER_API_KEY في Vercel → Settings → Environment Variables`,
    })
  }

  try {
    let text
    if (hasAnthropic) {
      text = await callAnthropic(subject, messages)
    } else if (hasOpenRouter) {
      text = await callOpenRouter(subject, messages)
    } else if (hasGroq) {
      text = await callGroq(subject, messages)
    } else {
      text = await callGemini(subject, messages)
    }
    return Response.json({ text })
  } catch (err) {
    return Response.json(
      { error: 'تعذّر الاتصال بالمساعد الذكي: ' + err.message },
      { status: 500 }
    )
  }
}
