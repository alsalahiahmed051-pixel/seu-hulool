/**
 * Sending a login code over WhatsApp.
 *
 * The owner asked for the code to arrive by WhatsApp — «خليه الكود على الواتس
 * يجي عبر الرقم». Sending it *automatically* needs a Meta Business account and
 * an approved message template, which is the owner's paperwork and not code.
 *
 * What is free and works today is a wa.me link: one tap opens WhatsApp on the
 * right conversation with the whole message already written, and the owner
 * presses send. That is one tap more than automatic and needs nothing set up.
 *
 * Pure — no network, no database — so the number handling below can be checked
 * without either.
 */

/** Arabic-Indic and Eastern Arabic digits, because that is what gets typed. */
const DIGIT_MAP = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
}

const SAUDI = '966'

/**
 * A phone number as wa.me wants it: digits only, country code included, no
 * plus and no leading zeros.
 *
 * Saudi numbers are written four ways in practice — 0501234567, 501234567,
 * +966501234567, 00966501234567 — and all four mean the same person. Rejecting
 * three of them would make the field a puzzle. Anything that is already
 * international is passed through, so a non-Saudi student still works.
 *
 * Returns '' when there is nothing usable, rather than a half-number: a wrong
 * number opens a chat with a stranger, and the code is in the message.
 */
export function waNumber(input) {
  let s = String(input == null ? '' : input)
  s = s.replace(/[٠-٩۰-۹]/g, d => DIGIT_MAP[d] || d)
  s = s.replace(/\D/g, '')
  if (!s) return ''

  if (s.startsWith('00')) s = s.slice(2)
  if (s.startsWith(SAUDI)) {
    const rest = s.slice(3).replace(/^0+/, '')
    return rest.length === 9 ? SAUDI + rest : ''
  }
  // 05XXXXXXXX — the way it is written locally.
  if (s.length === 10 && s.startsWith('05')) return SAUDI + s.slice(1)
  // 5XXXXXXXX — the same number without the trunk zero.
  if (s.length === 9 && s.startsWith('5')) return SAUDI + s
  // Already international, some other country.
  if (s.length >= 10 && s.length <= 15) return s
  return ''
}

/**
 * The message the student receives.
 *
 * It names the page explicitly because the site has two codes and nothing on
 * screen told them apart: the six digits that confirm an email at sign-up, and
 * this one. A student who takes an admin code to the sign-up page is stuck
 * through no fault of their own — so the message carries the link and says
 * outright not to use the other door.
 */
export function inviteMessage({ code, origin, name }) {
  const url = `${String(origin || '').replace(/\/+$/, '')}/login`
  const hello = name ? `أهلاً ${name} 👋` : 'أهلاً بك 👋'
  return [
    hello,
    '',
    'هذا كود دخولك إلى «حلول SEU»:',
    code,
    '',
    `افتح الرابط: ${url}`,
    'ثم اضغط «لدي كود دخول من الإدارة» والصق الكود.',
    '',
    'ملاحظة: لا تستخدمه في صفحة إنشاء حساب — الكود يدخلك مباشرة بلا بريد ولا كلمة مرور.',
    'صالح لمرة واحدة، وينتهي بعد ٧ أيام.',
  ].join('\n')
}

/** A wa.me link, or '' when the number is unusable. */
export function waLink(phone, text) {
  const n = waNumber(phone)
  if (!n) return ''
  return `https://wa.me/${n}?text=${encodeURIComponent(String(text || ''))}`
}
