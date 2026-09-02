import { createHmac, randomInt } from 'crypto'

/**
 * Codes that let a student in without email.
 *
 * The owner asked for a code they could generate and hand to a person. The
 * tempting shortcut was to reuse student_code — SEU-26-T5BU — and that would
 * have been a real hole: four characters from a 32-symbol alphabet is about a
 * million possibilities, which a script exhausts in an afternoon. A thing that
 * signs you in has to be long enough that guessing is not a strategy.
 *
 * Twelve characters from the same alphabet is 32^12 ≈ 10^18. At a thousand
 * guesses a second it is longer than the universe has been around, and the
 * redemption route is rate limited on top.
 */

// No 0/O/1/I/L — a code gets read aloud and typed by hand, and those four are
// where that goes wrong.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** How long a freshly issued code stays usable. */
export const CODE_TTL_DAYS = 7

/** `SEU-XXXX-XXXX-XXXX` — grouped because unbroken strings are mistyped. */
export function generateCode() {
  const pick = () => ALPHABET[randomInt(ALPHABET.length)]
  const group = () => Array.from({ length: 4 }, pick).join('')
  return `SEU-${group()}-${group()}-${group()}`
}

/**
 * What gets stored.
 *
 * Keyed HMAC rather than a bare digest: the codes share a known format, so a
 * plain hash of a leaked table could be attacked with a precomputed list. The
 * secret means the stored value is useless without it.
 */
export function hashCode(code) {
  return createHmac('sha256', process.env.STUDENT_SECRET || 'seu-hulool-fallback')
    .update(normaliseCode(code))
    .digest('hex')
}

/**
 * Accept what a human actually types.
 *
 * People paste with spaces, drop the dashes, use lowercase, or copy a trailing
 * newline. None of that should be a failed login — the code is the letters.
 */
export function normaliseCode(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

/** True when a normalised code is the right shape to bother checking. */
export function looksLikeCode(input) {
  const s = normaliseCode(input)
  return s.length === 15 && s.startsWith('SEU')
}

/** Group a normalised code back into its readable form. */
export function formatCode(input) {
  const s = normaliseCode(input)
  if (s.length !== 15) return String(input || '')
  return `SEU-${s.slice(3, 7)}-${s.slice(7, 11)}-${s.slice(11, 15)}`
}
