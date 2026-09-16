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
import { withDeadline, budget } from '@/lib/deadline'
import { judgeAnswer } from '@/lib/answer-quality'
import { explainFailure } from '@/lib/provider-errors'
import { isUsable, cooldownLeft, noteFailure, noteSuccess } from '@/lib/provider-health'
import { geminiGenerate } from '@/lib/gemini-model'
import { groqChat } from '@/lib/groq-model'
import { DEFAULT_POINTS } from '@/lib/ai-points'
import { geminiKeys, groqKeys, openRouterKeys, anthropicKeys } from '@/lib/api-keys'

export const runtime = 'nodejs'
// The platform kills a function at ten seconds unless told otherwise.
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

async function callAnthropic(subject, messages, grounding) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY })
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: MAX_ANSWER_TOKENS,
    system: buildSystem(subject, grounding),
    messages,
  })
  const text = res.content[0]?.text
  if (!text) throw new Error('empty response')
  return text
}

/** Every free model OpenRouter is currently serving, best-first. */
/**
 * The free catalogue, remembered for an hour.
 *
 * The owner's diagnosis said «OpenRouter: المزوّد لم يستجب». It is the last
 * provider tried, so by then little time is left — and it was spending that
 * little on a CATALOGUE request before asking anything, then walking up to
 * five models one at a time. Six sequential round trips to a provider whose
 * free models are the slowest thing here: the deadline was always going to
 * win.
 *
 * The catalogue barely changes from hour to hour, so it is fetched once and
 * kept. Now the first question of the hour pays for it and the rest go
 * straight to a model.
 */
let orCatalogue = { at: 0, list: [] }
const OR_TTL_MS = 60 * 60 * 1000

async function getFreeModelList() {
  if (orCatalogue.list.length && Date.now() - orCatalogue.at < OR_TTL_MS) {
    return orCatalogue.list
  }
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${OPENROUTER_KEY}` },
    })
    if (!r.ok) return []
    const data = await r.json()
    const list = (data.data || [])
      .filter(m => {
        const p = m.pricing?.prompt
        return p === '0' || p === 0 || p === '0.0' || Number(p) === 0
      })
      .sort((a, b) => modelScore(b) - modelScore(a))
    if (list.length) orCatalogue = { at: Date.now(), list }
    return list
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
async function callOpenRouterVision(subject, messages, grounding, image) {
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
            { role: 'system', content: buildSystem(subject, grounding) },
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

async function callOpenRouter(subject, messages, grounding) {
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
          messages: [{ role: 'system', content: buildSystem(subject, grounding) }, ...messages],
          max_tokens: MAX_ANSWER_TOKENS,
        }),
      })
      const data = await r.json()
      if (r.ok && data.choices?.[0]?.message?.content)
        return data.choices[0].message.content
    } catch {}
  }

  // Fallback: try each model individually — but only the best two. This ran
  // through all eight, and eight sequential requests to the slowest provider
  // on the list is how «لم يستجب» happens: the deadline arrives long before
  // the eighth model does. The route's own fallback chain is the redundancy
  // here, not this loop.
  const errors = []
  for (const model of freeModels.slice(0, 2)) {
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
          messages: [{ role: 'system', content: buildSystem(subject, grounding) }, ...messages],
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

async function callGroq(subject, messages, grounding) {
  // Also NOT a hardcoded name. `llama3-70b-8192` lived here until Groq
  // decommissioned it, and replacing it by hand with two newer names was the
  // same mistake with a later expiry date. groqChat asks Groq for its own
  // catalogue when — and only when — the name is what was refused.
  return groqChat(GROQ_SET, [
    { role: 'system', content: buildSystem(subject, grounding) },
    ...messages,
  ], { max_tokens: MAX_ANSWER_TOKENS, temperature: 0.7 })
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

async function callGemini(subject, messages, grounding, image) {
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))
  const lastMsg = messages[messages.length - 1].content
  // Flash models read images on the free tier, which is why the picture goes
  // here rather than to the paid provider.
  const img = image ? inlineImage(image) : null
  const lastParts = img
    ? [{ text: lastMsg }, { inline_data: img }]
    : [{ text: lastMsg }]
  const body = {
    system_instruction: { parts: [{ text: buildSystem(subject, grounding) }] },
    contents: [...history, { role: 'user', parts: lastParts }],
    generationConfig: { maxOutputTokens: MAX_ANSWER_TOKENS, temperature: 0.7 },
  }
  // NOT a hardcoded model name. `gemini-2.0-flash` was written into this URL
  // by hand, and Google retires models on its own schedule without asking —
  // a retired name answers 404, which the site could only report as «المساعد
  // الذكي غير متاح». geminiGenerate tries the name we trust, and when the
  // NAME is what was refused it asks Google what this key can call today,
  // retries, and caches the working name for an hour. See gemini-model.js.
  const text = await geminiGenerate(GEMINI_SET, body)
  if (!text) throw new Error('empty response from Gemini')
  return text
}

function buildSystem(subject, grounding) {
  // The boundary lives in one place, shared with the quiz route: "عام" is a
  // university-wide assistant, not a general-purpose one.
  let sys = `${scopeRules(subject)}

مهمتك مساعدة الطلاب في: شرح المفاهيم، تلخيص الوحدات، حل الأسئلة، وتقديم نصائح دراسية.
قواعد:
- أجب بلغة السؤال: سؤالٌ بالعربية يُجاب بالعربية، وبالإنجليزية بالإنجليزية. وإن كانت مقاطع الملفات بلغة أخرى فالعبرة بلغة الطالب
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
  }
  return sys
}

export async function POST(request) {
  // 1) The site is public (no accounts), so this endpoint serves anonymous
  // visitors. It still calls paid providers, so every caller is rate limited
  // by IP below — that budget is the only thing standing between the site and
  // provider abuse, so keep it in place.
  const caller = callerKey(request)
  // Started HERE, not at the provider loop: see the note below on «هلا».
  const clock = budget()

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
  const { deviceId, setCookie } = deviceIdentity(request)

  /**
   * ── Why «هلا» took over a minute and then said «تعذر» ──────────────────
   *
   * Everything below used to run STRICTLY ONE AFTER ANOTHER, and none of it
   * had a clock: the file lookup, two Upstash calls, the session read, the
   * points config, the subscription (asked TWICE), the usage balance, the
   * paid-quota check. Eight or nine round trips to two different services
   * before the model was sent a single word — and on a cold function, in a
   * region away from the database, that is tens of seconds of nothing.
   *
   * Then the provider loop started its own fresh forty-second budget on top.
   * The total ran past the platform's sixty-second limit, the function was
   * killed mid-flight, and the browser got an HTML error page where JSON
   * should have been — which lands in the same catch as a dead network and
   * reads, to the student, as «تعذر» after a minute of waiting. For «هلا».
   *
   * So: one round instead of eight, every piece on its own short clock, and
   * a safe answer for anything that does not come back in time. None of this
   * is needed to say hello, and none of it may hold the answer hostage.
   */
  const soft = (p, ms, fallback) =>
    withDeadline(Promise.resolve(p), ms).catch(() => fallback)

  const [grounding, minuteCheck, dayCheck, userId, points, subscribed, paidExhausted] =
    await Promise.all([
      // Retrieval is an improvement to the answer, never a precondition for
      // it. A library that is slow to read costs the student four seconds,
      // then the question is answered from the model's own knowledge.
      soft(contextFor(subject, lastAsk), 4000, { context: '', sources: [], hasFiles: false, indexed: 0 }),
      // The limiters guard the providers from abuse. When Upstash itself
      // stops answering, refusing every student protects nothing and breaks
      // everything — so a TIMEOUT (not a refusal) lets the question through.
      soft(aiPerMinuteLimit.limit(caller), 3000, { success: true, reset: Date.now() }),
      soft(aiDailyLimit.limit(caller), 3000, { success: true, reset: Date.now() }),
      soft((async () => {
        try {
          const supabase = await createClient()
          const { data: { user } } = await supabase.auth.getUser()
          return user?.id || null
        } catch { return null }
      })(), 3000, null),
      soft(readPointsConfig(), 3000, { ...DEFAULT_POINTS }),
      // Falling back to "not subscribed" keeps the allowance in force rather
      // than handing out an unlimited assistant when the database is slow.
      soft(isSubscribed(deviceId), 3000, false),
      // And to "spent", so a slow check never reaches for the paid provider.
      soft(paidQuotaExhausted(request, deviceId), 3000, true),
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
  if (body.trial === true && !subscribed) {
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

  if (!subscribed) {
    const usage = await soft(readUsage(owner, points.free), 3000,
      // Unreadable balance must not lock a student out of their own quota.
      { used: 0, remaining: points.free, resetAt: 0 })
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
  const geminiUsable = GEMINI_SET.length > 0
  if (hasImage) {
    if (geminiUsable)
      providers.push({ name: 'Gemini', paid: false, fn: () => callGemini(subject, messages, grounding, image) })
    // OpenRouter serves free vision models too. Without this, a site holding
    // only the OpenRouter key — the key its own setup text asks for — refused
    // every picture.
    if (OPENROUTER_SET.length > 0)
      providers.push({ name: 'OpenRouter-vision', paid: false, fn: () => callOpenRouterVision(subject, messages, grounding, image) })
    if (ANTHROPIC_SET.length > 0 && providers.length === 0) {
      // Only if there is no free reader at all: this one costs money.
      providers.push({ name: 'Anthropic', paid: true, fn: () => callAnthropic(subject, messages, grounding) })
    }
    if (providers.length === 0) {
      return reply({ error: 'قراءة الصور غير مفعّلة على هذا الموقع بعد — أرسل سؤالك نصاً.' }, 503)
    }
  } else {
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
    if (geminiUsable)
      providers.push({ name: 'Gemini', paid: false, fn: () => callGemini(subject, messages, grounding) })
    if (GROQ_SET.length > 0)
      providers.push({ name: 'Groq', paid: false, fn: () => callGroq(subject, messages, grounding) })
    if (OPENROUTER_SET.length > 0)
      providers.push({ name: 'OpenRouter', paid: false, fn: () => callOpenRouter(subject, messages, grounding) })
  }

  let paidAllowed = false
  if (!hasImage && ANTHROPIC_SET.length > 0) {
    paidAllowed = !paidExhausted
    if (paidAllowed) {
      providers.push({ name: 'Anthropic', paid: true, fn: () => callAnthropic(subject, messages, grounding) })
    }
  }

  if (providers.length === 0) {
    // Either nothing is configured, or only the paid key is and it is spent.
    if (paidAllowed === false && ANTHROPIC_SET.length > 0) {
      return reply({
        error: `استهلكت رصيدك اليومي من المساعد الذكي (${PAID_DAILY_LIMIT} رسائل). جرّب غداً.`,
      }, 429)
    }
    return reply({
      text: `المساعد الذكي غير مفعّل بعد.\n\nللتفعيل المجاني:\n١. افتح openrouter.ai\n٢. سجّل دخولك بحساب Google\n٣. اضغط "Keys" ← "Create Key"\n٤. أضف OPENROUTER_API_KEY في Vercel → Settings → Environment Variables`,
    })
  }

  // Try each provider in turn — first success wins, and nobody gets to hang.
  // The clock is the point: an overloaded provider used to hold the whole
  // function open until the platform killed it at sixty seconds, so the
  // student waited a minute for an apology. See src/lib/deadline.js.
  const errors = []

  /**
   * The reply that will be sent, once something passes.
   *
   * «أحياناً تمام، أحياناً لا، يخبط» is the provider chain showing through:
   * Gemini answers well, and when its free quota runs out the question falls
   * to Llama and then to OpenRouter's rotating free catalogue. The chain is
   * why the assistant never goes dark — but the loop's only test was
   * `if (text)`, so a single word, a sentence cut in half, or English for an
   * Arabic question was shown as the answer just the same.
   *
   * Now a reply is judged before it is shown, and a failure moves to the next
   * provider. `best` keeps the least-bad rejected reply: if every provider
   * fails the judgement, showing the strongest of them still beats «تعذر».
   */
  let best = null
  const finish = async (text, paid) => {
    // Only a successful paid reply spends the provider budget; free ones
    // never do. The student's own allowance is spent on any answered
    // question, free or paid, but never on a failure.
    if (paid) await consumePaidQuota(request, deviceId)
    // The answer is already written. A slow ledger must not hold it back:
    // the spend is still awaited (a dropped write is a free question, and
    // Vercel may end the function the moment this responds) — but on a
    // clock, so a stalled database costs seconds, not the whole answer.
    const usage = subscribed
      ? null
      : await soft(spendPoints(owner, cost, points.free), 4000, null)
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

  for (let i = 0; i < providers.length; i++) {
    const { name, paid, fn } = providers[i]
    if (i > 0 && !clock.canTry()) {
      errors.push(`${name}: skipped — out of time`)
      break
    }
    // A provider that said "out of quota" a moment ago will say it again, and
    // the round trip to hear it costs the student a second or more of every
    // question. See src/lib/provider-health.js.
    if (!isUsable(name)) {
      errors.push(`${name}: skipped — cooling down ${cooldownLeft(name)}s`)
      continue
    }
    try {
      const text = await withDeadline(fn(), clock.next(providers.length - i))
      if (text) {
        noteSuccess(name)
        const verdict = judgeAnswer(text, lastAsk)
        if (verdict.ok) return await finish(text, paid)
        // Not shown — but remembered, in case nothing better arrives.
        errors.push(`${name}: rejected (${verdict.reason})`)
        if (!best || verdict.score > best.score) best = { text, paid, score: verdict.score }
      }
    } catch (err) {
      noteFailure(name, err.message)
      errors.push(`${name}: ${err.message}`)
    }
  }

  // Everything was judged poor. A weak answer is still an answer, and the
  // student asked a question — so the strongest of them is sent rather than
  // an apology for replies we actually received.
  if (best) {
    console.error('[api/ai] all replies judged poor:', errors.join(' | '))
    return await finish(best.text, best.paid)
  }

  console.error('[api/ai] all providers failed:', errors.join(' | '))

  /**
   * The apology now says WHY, and it is safe to say to anyone.
   *
   * Six identical words covered five different problems with five different
   * fixes — no key, a rejected key, an exhausted quota, a dead model name, a
   * provider that never answered — so telling them apart meant guessing, and
   * this project spent days doing exactly that. explainFailure never echoes a
   * provider's own text (that text quotes the request, and for Gemini the
   * request carries the key), only its own fixed Arabic sentences.
   */
  const why = explainFailure(errors)
  // The apology stays the apology — for a student, a provider's error text is
  // noise. But it hid a plain scoping bug («grounding is not defined») behind
  // «جرّب بعد دقيقة» for as long as it took someone to ask, because the reason
  // went only to a server log nobody reads. So the owner, and only the owner,
  // gets the reason with the answer: a diagnosis he can act on without me.
  return reply(
    {
      error: why.error,
      kind: why.kind,
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
