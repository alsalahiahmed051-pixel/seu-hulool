/**
 * Turning «عذراً، المساعد الذكي غير متاح الآن» into a sentence you can act on.
 *
 * ── Why ─────────────────────────────────────────────────────────────────
 *
 * That apology is the same six words whether the key was never set, the key
 * was rejected, the free quota ran out, the model name died, or the provider
 * simply did not answer. Five different problems with five different fixes,
 * all wearing one face — so the only way to tell them apart was to guess, and
 * this whole project spent days doing exactly that.
 *
 * The real reason was always there, in the strings the loop collected. It went
 * to a server log nobody reads, and to an admin-only field that needed an
 * admin session the owner did not have while testing as a student.
 *
 * ── The rule that makes it safe to show anyone ──────────────────────────
 *
 * Nothing from the provider's own message is ever echoed. A provider quotes
 * the request it refused, and for Gemini that request is a URL with the key in
 * its query string — a diagnosis is never worth leaking a key for. So the
 * provider's text is only ever MATCHED against, never printed: what comes out
 * is one of the fixed Arabic sentences below, plus the provider's name, which
 * is not a secret. That is what makes this safe on a student's screen.
 */

/** The failure kinds, worst-understood last. */
export const FAILURE = {
  NO_KEY: 'no-key',
  BAD_KEY: 'bad-key',
  QUOTA: 'quota',
  SILENT: 'silent',
  MODEL: 'model',
  POOR: 'poor',
  UNKNOWN: 'unknown',
}

/** What the student — and the owner — reads. */
const SAY = {
  [FAILURE.NO_KEY]: 'لا يوجد مفتاح مضبوط لأي مزوّد',
  [FAILURE.BAD_KEY]: 'المفتاح مرفوض من المزوّد',
  [FAILURE.QUOTA]: 'انتهت الحصّة المجانية لهذا المزوّد',
  [FAILURE.SILENT]: 'المزوّد لم يستجب في الوقت المتاح',
  [FAILURE.MODEL]: 'لم يُقبل أي اسم نموذج لدى هذا المزوّد',
  [FAILURE.POOR]: 'ردّ بإجابة غير صالحة',
  [FAILURE.UNKNOWN]: 'رفض الطلب لسبب غير معروف',
}

/** What the OWNER should do about it — the half a log line never gives you. */
const FIX = {
  [FAILURE.BAD_KEY]: 'أنشئ مفتاحاً جديداً وضعه في Vercel ثم أعد النشر.',
  [FAILURE.QUOTA]: 'انتظر تجدّد الحصّة، أو أضف مفتاحاً ثانياً من حساب آخر.',
  [FAILURE.NO_KEY]: 'أضف GEMINI_API_KEY في Vercel → Settings → Environment Variables.',
  [FAILURE.SILENT]: 'غالباً ضغطٌ مؤقّت عند المزوّد — أعد المحاولة بعد قليل.',
  [FAILURE.MODEL]: 'المفتاح لا يملك صلاحية أي نموذج — تحقّق من تفعيله لدى المزوّد.',
}

/**
 * Read one provider's failure string and say what KIND of failure it was.
 *
 * Matched against, never echoed. The order matters: a quota refusal often
 * also carries the word "key", so quota is tested first.
 */
export function classifyOne(line) {
  const s = String(line || '')
  if (/rejected \(/i.test(s)) return FAILURE.POOR
  // «cooling down» is a quota refusal we are REMEMBERING rather than
  // re-asking for (see provider-health.js). Without this it fell through to
  // «سبب غير معروف» — the skip meant to speed things up would have made the
  // message worse than the round trip it saved.
  if (/cooling down/i.test(s)) return FAILURE.QUOTA
  if (/\b429\b|quota|rate.?limit|exhaust|too many requests|insufficient_quota/i.test(s)) return FAILURE.QUOTA
  if (/\b40[13]\b|api key not valid|invalid api key|unauthor|forbidden|permission denied|invalid_api_key/i.test(s)) return FAILURE.BAD_KEY
  if (/timed out|deadline|etimedout|econnreset|enotfound|socket hang up|\b50[234]\b|overload|unavailable/i.test(s)) return FAILURE.SILENT
  if (/\b404\b|not found|decommission|does not exist|no longer|no free models|no free vision/i.test(s)) return FAILURE.MODEL
  return FAILURE.UNKNOWN
}

/** The provider's name, from the `Name: reason` shape the loops record. */
const nameOf = (line) => {
  const m = String(line || '').match(/^([A-Za-z][A-Za-z0-9 _-]{0,24}):/)
  return m ? m[1].trim() : ''
}

/** Arabic names for the providers, so the sentence reads as one language. */
const AR_NAME = {
  Gemini: 'جيميناي',
  Groq: 'Groq',
  OpenRouter: 'OpenRouter',
  'OpenRouter-vision': 'OpenRouter (الصور)',
  Anthropic: 'Anthropic',
}
const say = (n) => AR_NAME[n] || n || 'المزوّد'

/**
 * One sentence explaining why nothing answered, safe for any screen.
 *
 * @param {string[]} errors the loop's own `Name: reason` lines
 * @returns {{error: string, kind: string}}
 */
export function explainFailure(errors = []) {
  const lines = (Array.isArray(errors) ? errors : []).filter(Boolean)
  if (!lines.length) {
    return { error: 'المساعد الذكي غير مفعّل — لا يوجد مفتاح مضبوط.', kind: FAILURE.NO_KEY }
  }

  const per = lines.map(l => ({ name: nameOf(l), kind: classifyOne(l) }))

  // When the wait is KNOWN — a remembered refusal carries its own clock —
  // say it. «جرّب بعد دقيقتين» is a different message from «انتظر».
  const waits = lines
    .map(l => Number(String(l).match(/cooling down (\d+)s/)?.[1] || 0))
    .filter(n => n > 0)
  const wait = waits.length === lines.length && waits.length ? Math.max(...waits) : 0
  const when = wait >= 60
    ? ` جرّب بعد ${Math.ceil(wait / 60)} دقيقة.`
    : wait > 0 ? ` جرّب بعد ${wait} ثانية.` : ''

  // Every provider hit the same wall → name the wall, and the way past it.
  const kinds = [...new Set(per.map(p => p.kind))]
  if (kinds.length === 1) {
    const kind = kinds[0]
    const fix = when || (FIX[kind] ? ` ${FIX[kind]}` : '')
    return {
      error: `تعذّر الحصول على إجابة: ${SAY[kind]}.${fix}`,
      kind,
    }
  }

  // Different walls → list them, shortest form, one provider each.
  const detail = per
    .filter((p, i, a) => a.findIndex(x => x.name === p.name) === i)
    .map(p => `${say(p.name)}: ${SAY[p.kind]}`)
    .join(' · ')
  // The most actionable kind leads the advice.
  const lead = [FAILURE.BAD_KEY, FAILURE.QUOTA, FAILURE.MODEL, FAILURE.SILENT]
    .find(k => kinds.includes(k))
  return {
    error: `تعذّر الحصول على إجابة — ${detail}.${lead && FIX[lead] ? ` ${FIX[lead]}` : ''}`,
    kind: lead || FAILURE.UNKNOWN,
  }
}
