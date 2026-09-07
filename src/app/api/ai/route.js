import { aiPerMinuteLimit, aiDailyLimit, callerKey } from '@/lib/rate-limit'
import { deviceIdentity, paidQuotaExhausted, consumePaidQuota, PAID_DAILY_LIMIT } from '@/lib/ai-quota'
import { readUsage, spendPoints, isSubscribed, looksLikeEmail, readPointsConfig } from '@/lib/ai-usage'
import { ownerKey, costOf } from '@/lib/ai-points'
import { claimTrial } from '@/lib/ai-trial'
import { BROWSE_TRIAL_AI } from '@/lib/auth-config'
import { createClient } from '@/lib/supabase/server'
import { scopeRules, resolveSubject } from '@/lib/ai-scope'
import { modelScore } from '@/lib/model-rank'
import { contextFor } from '@/lib/retrieval'
import { askScript, docScript, LANG_NAME } from '@/lib/lang'

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

/**
 * Room for a complete answer.
 *
 * It was 1024, which an explanation with worked steps runs past — and a reply
 * that stops mid-sentence reads to a student as the assistant breaking, not as
 * a limit being reached. Doubling it costs nothing on the free providers and a
 * fraction of a cent on the paid one.
 */
const MAX_ANSWER_TOKENS = 2048

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.OpenRouter

async function callAnthropic(subject, messages, grounding, askLang) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY })
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: MAX_ANSWER_TOKENS,
    system: buildSystem(subject, grounding, askLang),
    messages,
  })
  const text = res.content[0]?.text
  if (!text) throw new Error('empty response')
  return text
}

/** Every free model OpenRouter is currently serving, best-first. */
async function getFreeModelList() {
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
      .sort((a, b) => modelScore(b) - modelScore(a))
  } catch {
    return []
  }
}

async function getFreeModels() {
  return (await getFreeModelList()).map(m => m.id).slice(0, 8)
}

/**
 * The free models that can actually look at a picture.
 *
 * Reading images used to require a Gemini key, so a site configured with only
 * the OpenRouter key — the one the app's own setup text tells owners to get —
 * answered every photo with "قراءة الصور غير مفعّلة". OpenRouter serves free
 * vision models too; this finds them, so the picture works with the key the
 * owner already has.
 */
async function getFreeVisionModels() {
  return (await getFreeModelList())
    .filter(m => {
      const arch = m.architecture || {}
      const inputs = arch.input_modalities || arch.modality || ''
      return Array.isArray(inputs)
        ? inputs.includes('image')
        : String(inputs).includes('image')
    })
    .map(m => m.id)
    .slice(0, 4)
}

/** Ask a free OpenRouter vision model about the attached picture. */
async function callOpenRouterVision(subject, messages, grounding, askLang, image) {
  const models = await getFreeVisionModels()
  if (models.length === 0) throw new Error('no free vision models on OpenRouter')

  // Only the newest turn carries the picture; earlier turns stay plain text.
  const history = messages.slice(0, -1)
  const last = messages[messages.length - 1]
  const withImage = {
    role: 'user',
    content: [
      { type: 'text', text: last?.content || 'حلّ هذا السؤال من الصورة.' },
      { type: 'image_url', image_url: { url: image } },
    ],
  }

  const errors = []
  for (const model of models) {
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
          messages: [
            { role: 'system', content: buildSystem(subject, grounding, askLang) },
            ...history,
            withImage,
          ],
          max_tokens: MAX_ANSWER_TOKENS,
        }),
      })
      const data = await r.json()
      if (!r.ok) { errors.push(`${model}: ${data.error?.message}`); continue }
      const text = data.choices?.[0]?.message?.content
      if (text) return text
    } catch (e) { errors.push(`${model}: ${e.message}`) }
  }
  throw new Error(errors.join(' | ') || 'vision models returned nothing')
}

async function callOpenRouter(subject, messages, grounding, askLang) {
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
          messages: [{ role: 'system', content: buildSystem(subject, grounding, askLang) }, ...messages],
          max_tokens: MAX_ANSWER_TOKENS,
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
          messages: [{ role: 'system', content: buildSystem(subject, grounding, askLang) }, ...messages],
          max_tokens: MAX_ANSWER_TOKENS,
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

async function callGroq(subject, messages, grounding, askLang) {
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
            { role: 'system', content: buildSystem(subject, grounding, askLang) },
            ...messages,
          ],
          max_tokens: MAX_ANSWER_TOKENS,
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

/**
 * Split a data: URL into what Gemini's inline_data wants.
 *
 * Returns null for anything that is not an image data URL, so a malformed or
 * unexpected value degrades to a text-only question rather than being passed
 * through to the provider.
 */
function inlineImage(dataUrl) {
  const m = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''))
  if (!m) return null
  return { mime_type: m[1], data: m[2] }
}

async function callGemini(subject, messages, grounding, askLang, image) {
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))
  const lastMsg = messages[messages.length - 1].content
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`
  // gemini-1.5-flash reads images on the free tier, which is why the picture
  // goes here rather than to the paid provider.
  const img = image ? inlineImage(image) : null
  const lastParts = img
    ? [{ text: lastMsg }, { inline_data: img }]
    : [{ text: lastMsg }]
  const body = {
    system_instruction: { parts: [{ text: buildSystem(subject, grounding, askLang) }] },
    contents: [...history, { role: 'user', parts: lastParts }],
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

function buildSystem(subject, grounding, askLang = 'ar') {
  // The boundary lives in one place, shared with the quiz route: "عام" is a
  // university-wide assistant, not a general-purpose one.
  //
  // The language rule below replaced «أجب دائماً باللغة العربية». That rule was
  // wrong in both directions: it answered an English question in Arabic, and it
  // made an Arabic answer about English material translate away the very terms
  // the student is examined on. Many SEU courses are taught in English while
  // their students think and ask in Arabic, so the two languages are not a
  // choice between each other — the explanation follows the student, the
  // terminology follows the exam.
  const langRule = askLang === 'en'
    ? `- Answer in English, since the question was asked in English`
    : `- أجب بالعربية الفصيحة البسيطة، لأن السؤال طُرح بالعربية`

  let sys = `${scopeRules(subject)}

مهمتك مساعدة الطلاب في: شرح المفاهيم، تلخيص الوحدات، حل الأسئلة، وتقديم نصائح دراسية.
قواعد:
${langRule}
- كن موجزاً ودقيقاً ومفيداً
- استخدم النقاط والعناوين (##) لتنظيم الإجابة عند الحاجة
- إن كان السؤال عن معلومة خاصة بهذا المقرر لا تعرفها — موعد اختبار، رقم فصل في الكتاب، توزيع الدرجات، اسم المحاضر — قل إنك لا تعرفها ووجّه الطالب إلى البلاكبورد أو الدعم، ولا تخمّنها
- إذا كان السؤال ناقصاً أو يحتمل أكثر من معنى، اسأل سؤالاً توضيحياً واحداً قبل الإجابة
- أنهِ إجابتك عند نقطة مكتملة؛ لا تبدأ قسماً لا تستطيع إتمامه`
  // The passages themselves, when the course has readable files. Placed after
  // the rules so the model reads them as evidence to answer FROM, and told
  // plainly what to do when they do not cover the question — a model that
  // must not say "the files do not cover this" will always invent something
  // that sounds like they did.
  if (grounding && grounding.context) {
    sys += `

── مقاطع من ملفات هذه المادة المرفوعة في المنصّة ──
${grounding.context}
── نهاية المقاطع ──

قواعد استخدام المقاطع:
- أجب من هذه المقاطع أولاً، وأشر إلى اسم الملف الذي أخذت منه.
- المقاطع مستخرجة آلياً من ملفات PDF وقد تحتوي أخطاء أو كلمات مشوّهة — افهم المعنى ولا تنقل التشويه.
- إن لم تكفِ المقاطع للإجابة، قل ذلك صراحةً ثم أجب من معرفتك العامة بالمادة، ووضّح أن هذا الجزء ليس من الملفات.
- لا تنسب إلى الملفات ما ليس فيها.`

    // The bilingual rule, and only when the material is really in another
    // language than the question. A student asking in Arabic about an English
    // course must not be handed «الإهلاك» alone: the exam paper will say
    // "depreciation", and an answer that translated the term away has taught
    // them something they cannot recognise when it counts.
    const docLang = docScript(grounding.context)
    if (docLang && docLang !== 'mixed' && docLang !== askLang) {
      sys += `
- ملفات هذه المادة بـ${LANG_NAME[docLang]} والسؤال بـ${LANG_NAME[askLang] || LANG_NAME.ar}: اشرح بلغة السؤال، واكتب المصطلحات والرموز والصيغ كما وردت في الملف لا مترجمةً — فورقة الاختبار ستستعمل لفظ الملف.
- وابقَ موجزاً: لا تشرح كل مصطلح، اشرح ما سُئلت عنه.`
    }
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

  /**
   * What the course's own files say about this question.
   *
   * Looked up HERE, on the server, from the real library — not taken from the
   * client. The old `fileContext` was assembled in the browser out of file
   * NAMES (plus, for `.txt` files only, 600 characters), and a body field the
   * caller controls is also a free hand into the system prompt. The client's
   * copy is ignored now; this is the grounding.
   */
  const lastAsk = [...messages].reverse().find(m => m.role === 'user')?.content || ''
  let grounding = { context: '', sources: [], hasFiles: false, indexed: 0 }
  try { grounding = await contextFor(subject, lastAsk) } catch { /* answer ungrounded rather than fail */ }

  // The language to answer in, measured from what the student actually wrote
  // rather than fixed to Arabic. See lib/lang: an Arabic sentence carrying
  // English terms is an Arabic question, which is the ordinary shape of a
  // question about an English-taught course.
  const askLang = askScript(lastAsk) || 'ar'

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

  // 3b) No email gate. Identity is the signed device cookie (and the account
  // when there is one) — the same key the allowance is counted against below.
  // The site no longer collects an email anywhere, so requiring one here would
  // block every question.

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
  // One image, capped. A base64 data URL is about a third larger than the file,
  // so ~4MB of string is roughly a 3MB photo — enough for a page of a textbook
  // and small enough not to blow up the request.
  const MAX_IMAGE_CHARS = 4_000_000
  const rawImage = typeof body.image === 'string' ? body.image : ''
  const image = rawImage.startsWith('data:image/') && rawImage.length <= MAX_IMAGE_CHARS
    ? rawImage
    : ''
  if (rawImage && !image) {
    return reply({ error: 'الصورة كبيرة أو غير مدعومة — جرّب صورة أصغر (PNG أو JPG).' }, 400)
  }
  const hasImage = Boolean(image)
  const cost = costOf(hasImage ? 'image' : 'message', points)

  // Filled in below when this was a trial question, so the reply can carry the
  // server's own count — the client should render what was actually spent,
  // not its own guess at it.
  let trialState = null

  // 3d) The browse trial, for a visitor who has not made a profile yet.
  //
  // The client says whether this is a trial question, because only the client
  // can see a device-local profile — the server has nothing to read. That is
  // safe in the direction that matters: forging `trial:false` skips the trial,
  // but a profile is a free form anyone can fill in a few seconds, so there is
  // nothing there worth defending. What this DOES close is the loophole the
  // count had while it lived in localStorage — clearing site data or opening a
  // private window no longer restores it, because the count is keyed on the
  // signed device cookie and the caller's IP, neither of which the page can
  // touch. See src/lib/ai-trial.js for why the IP is a ceiling, not the trial.
  if (body.trial === true && !(await isSubscribed(deviceId))) {
    const trial = await claimTrial(request, deviceId)
    if (trial.error) {
      // A database that cannot answer must not become a free pass — nor a
      // silent ban. Refuse this one request and say why.
      return reply({ error: 'تعذّر التحقق من تجربتك — حاول بعد قليل.' }, 503)
    }
    if (!trial.ok) {
      return reply({
        error: `انتهت تجربتك المجانية (${BROWSE_TRIAL_AI} أسئلة). أكمل ملفك لاستخدام المساعد بلا حدود.`,
        need: 'profile',
        trialUsed: true,
        trialLimit: BROWSE_TRIAL_AI,
        used: trial.used,
        remaining: 0,
      }, 402)
    }
    trialState = trial
  }

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
  // A question carrying an image may only go to a provider that can see it.
  // Falling through to a text-only model would not fail — it would answer
  // confidently about a picture it never received, which is worse than an
  // error because nothing about the reply says it did not look.
  const geminiUsable = GEMINI_KEY && !GEMINI_KEY.includes('placeholder') && GEMINI_KEY.length > 20
  if (hasImage) {
    if (geminiUsable)
      providers.push({ name: 'Gemini', paid: false, fn: () => callGemini(subject, messages, grounding, askLang, image) })
    // OpenRouter serves free vision models too. Without this, a site holding
    // only the OpenRouter key — the key its own setup text asks for — refused
    // every picture.
    if (OPENROUTER_KEY && !OPENROUTER_KEY.includes('placeholder'))
      providers.push({ name: 'OpenRouter-vision', paid: false, fn: () => callOpenRouterVision(subject, messages, grounding, askLang, image) })
    if (ANTHROPIC_KEY && !ANTHROPIC_KEY.includes('placeholder') && providers.length === 0) {
      // Only if there is no free reader at all: this one costs money.
      providers.push({ name: 'Anthropic', paid: true, fn: () => callAnthropic(subject, messages, grounding, askLang) })
    }
    if (providers.length === 0) {
      return reply({ error: 'قراءة الصور غير مفعّلة على هذا الموقع بعد — أرسل سؤالك نصاً.' }, 503)
    }
  } else {
    if (GROQ_KEY && !GROQ_KEY.includes('placeholder'))
      providers.push({ name: 'Groq', paid: false, fn: () => callGroq(subject, messages, grounding, askLang) })
    if (geminiUsable)
      providers.push({ name: 'Gemini', paid: false, fn: () => callGemini(subject, messages, grounding, askLang) })
    if (OPENROUTER_KEY && !OPENROUTER_KEY.includes('placeholder'))
      providers.push({ name: 'OpenRouter', paid: false, fn: () => callOpenRouter(subject, messages, grounding, askLang) })
  }

  let paidAllowed = false
  if (!hasImage && ANTHROPIC_KEY && !ANTHROPIC_KEY.includes('placeholder')) {
    paidAllowed = !(await paidQuotaExhausted(request, deviceId))
    if (paidAllowed) {
      providers.push({ name: 'Anthropic', paid: true, fn: () => callAnthropic(subject, messages, grounding, askLang) })
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
          // The server's own count, so the trial bar shows what was really
          // spent rather than a number the page kept for itself.
          ...(trialState ? { trial: { used: trialState.used, remaining: trialState.remaining, limit: BROWSE_TRIAL_AI } } : {}),
          // Which of the course's files this answer was grounded in, so the
          // student can see the answer came from their material and open it.
          ...(grounding.sources.length ? { sources: grounding.sources } : {}),
        })
      }
    } catch (err) {
      errors.push(`${name}: ${err.message}`)
    }
  }

  console.error('[api/ai] all providers failed:', errors.join(' | '))
  // The apology stays the apology — for a student, a provider's error text is
  // noise. But it hid a plain scoping bug («grounding is not defined») behind
  // «جرّب بعد دقيقة» for as long as it took someone to ask, because the reason
  // went only to a server log nobody reads. So the owner, and only the owner,
  // gets the reason with the answer: a diagnosis he can act on without me.
  return reply(
    {
      error: `عذراً، المساعد الذكي غير متاح الآن. جرّب مجدداً بعد دقيقة.`,
      ...(await adminDetail(errors)),
    },
    500
  )
}

/**
 * Why every provider failed, for an admin caller only.
 *
 * Redacted the same way the storage self-test redacts: an error message can
 * carry the URL a key was appended to, and a reason worth showing is never
 * worth leaking a key for.
 */
async function adminDetail(errors) {
  try {
    const { requireAdmin } = await import('@/lib/admin-guard')
    const gate = await requireAdmin()
    if (!gate.ok) return {}
  } catch {
    return {}
  }
  const detail = errors
    .map(e => String(e)
      .replace(/https?:\/\/\S+/g, '[url]')
      .replace(/(key|token|api[_-]?key)=\S+/gi, '$1=[redacted]')
      .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[redacted]'))
    .join(' | ')
    .slice(0, 400)
  return detail ? { detail } : {}
}
