/**
 * What the admin bot is allowed to do, and how a proposal is made safe.
 *
 * The owner wanted to run the site by talking to it: «أرسله نص متعلق بتقويم
 * أو شي يروح يضيف أو يعدله». The risk in that is not the talking, it is that
 * a language model's output would otherwise become a database write.
 *
 * So the model never writes. It proposes, in a fixed vocabulary; this module
 * decides whether the proposal is something the site can actually do; and the
 * owner confirms before anything happens. Everything here is pure — no
 * database, no network — because this is the layer that has to be right, and
 * it should be checkable without either.
 */

/** Who an announcement or event can be aimed at. Mirrors AUDIENCE_OPTIONS. */
export const AUDIENCES = [
  'all',
  'track:تحضيري',
  'track:تخصص',
  'track:دبلوم',
  'track:دراسات عليا',
  'plan:تحضيري|خطة أ',
  'plan:تحضيري|خطة ب',
]

/** Colours a calendar event may carry, matching what the panel offers. */
const EVENT_COLORS = ['#2563eb', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2']
const EVENT_ICONS = ['Flame', 'Trophy', 'FileText', 'GraduationCap', 'PenLine', 'Calendar', 'Award', 'Bell', 'Star', 'BookOpen', 'CheckCircle', 'CreditCard']

/** The whole vocabulary. Anything not here cannot be proposed at all. */
export const ACTIONS = {
  'calendar.add': { label: 'إضافة حدث في التقويم' },
  'notification.add': { label: 'إرسال إعلان' },
}

const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max)

/**
 * Is this a real calendar date?
 *
 * Checked by round-trip rather than by regex shape: "2026-02-31" matches any
 * reasonable pattern and is not a day. A model asked for "آخر فبراير" will
 * produce exactly that sort of thing.
 */
export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/**
 * Turn one proposed action into something safe to execute, or explain why not.
 *
 * Returns { ok: true, action } or { ok: false, error }. Never throws and never
 * partially accepts: an action either arrives complete and valid or it is
 * refused, because a half-applied calendar entry is worse than none.
 */
export function validateAction(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'إجراء غير مفهوم' }
  const type = String(raw.type || '')
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, type)) {
    return { ok: false, error: `إجراء غير مسموح: ${type || '—'}` }
  }

  const audience = AUDIENCES.includes(raw.audience) ? raw.audience : 'all'

  if (type === 'calendar.add') {
    const label = str(raw.label, 120)
    if (!label) return { ok: false, error: 'الحدث يحتاج عنواناً' }
    if (!isValidDate(raw.date)) return { ok: false, error: 'التاريخ غير صحيح (YYYY-MM-DD)' }
    return {
      ok: true,
      action: {
        type,
        label,
        date: raw.date,
        audience,
        color: EVENT_COLORS.includes(raw.color) ? raw.color : '#2563eb',
        icon: EVENT_ICONS.includes(raw.icon) ? raw.icon : 'Calendar',
      },
    }
  }

  // notification.add
  const title = str(raw.title, 120)
  const body = str(raw.body, 1000)
  if (!title) return { ok: false, error: 'الإعلان يحتاج عنواناً' }
  if (!body) return { ok: false, error: 'الإعلان يحتاج نصاً' }
  return { ok: true, action: { type, title, body, audience } }
}

/**
 * Validate a whole proposal.
 *
 * A cap on how many actions one message may produce: a misread instruction
 * that turns into forty calendar entries is a mess to undo by hand, and no
 * real request needs more than a handful.
 */
export const MAX_ACTIONS = 10

export function validateProposal(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return { actions: [], errors: ['لم أفهم طلباً قابلاً للتنفيذ'] }
  }
  const actions = []
  const errors = []
  for (const raw of list.slice(0, MAX_ACTIONS)) {
    const r = validateAction(raw)
    if (r.ok) actions.push(r.action)
    else errors.push(r.error)
  }
  if (list.length > MAX_ACTIONS) {
    errors.push(`تجاهلت ما زاد عن ${MAX_ACTIONS} إجراءات في رسالة واحدة`)
  }
  return { actions, errors }
}

/** A one-line description of what an action will do, for the confirm step. */
export function describeAction(a) {
  const who = a.audience === 'all' ? 'لكل الطلاب'
    : a.audience.startsWith('track:') ? `لطلاب ${a.audience.slice(6)}`
      : a.audience.startsWith('plan:') ? `لطلاب ${a.audience.slice(5).replace('|', ' — ')}`
        : ''
  if (a.type === 'calendar.add') return `إضافة «${a.label}» في التقويم بتاريخ ${a.date} ${who}`
  return `إرسال إعلان «${a.title}» ${who}`
}

/** The instruction the model works to. */
export function botSystemPrompt(todayISO) {
  return `أنت مساعد إداري لموقع «حلول SEU». مهمتك تحويل طلب المسؤول إلى إجراءات.

اليوم هو ${todayISO}. أي تاريخ نسبي (بعد أسبوع، الأحد القادم) احسبه من هذا التاريخ.

أعد JSON فقط، مصفوفة إجراءات، بلا أي نص خارجها:
[{"type":"calendar.add","label":"...","date":"YYYY-MM-DD","audience":"..."}]
[{"type":"notification.add","title":"...","body":"...","audience":"..."}]

الأنواع المسموحة فقط: calendar.add و notification.add.
قيم audience المسموحة فقط: ${AUDIENCES.join(' | ')}
إن لم يحدّد المسؤول الجمهور فاستخدم "all".
إن لم تفهم الطلب أعد [].`
}

/** Pull the JSON array out of a model reply that may wrap it in prose. */
export function parseProposal(text) {
  const t = String(text || '').trim()
  try { const v = JSON.parse(t); if (Array.isArray(v)) return v } catch { /* try harder */ }
  const m = t.match(/\[[\s\S]*\]/)
  if (m) { try { const v = JSON.parse(m[0]); if (Array.isArray(v)) return v } catch { /* give up */ } }
  return null
}
