import { createAdminClient } from '@/lib/supabase/server'
import { loginCodeLimit, callerKey } from '@/lib/rate-limit'
import { hashCode, looksLikeCode, normaliseCode } from '@/lib/login-codes'

export const runtime = 'nodejs'

/**
 * Redeem a login code.
 *
 * This is the one public endpoint that hands out a session, so it is the one
 * that has to be careful:
 *
 * - Rate limited per caller. Twelve characters is far past guessable, but a
 *   limit costs nothing and removes the question entirely.
 * - Redeemed in a single statement (redeem_login_code), so the same code sent
 *   twice at once cannot succeed twice — which is the whole point of "single
 *   use".
 * - Every failure answers identically. Distinguishing "no such code" from
 *   "expired" from "already used" would tell someone probing which of their
 *   guesses were once real.
 *
 * The session itself comes from Supabase's own magic-link machinery, used
 * without sending any mail: the account is created if it is new, generateLink
 * returns a token hash, and the browser exchanges that for a session. So a
 * student can be let in on a site whose outgoing email does not work at all —
 * which is exactly the situation this site is in.
 */
export async function POST(request) {
  const rl = await loginCodeLimit.limit(callerKey(request))
  if (!rl.success) {
    return Response.json({ error: 'محاولات كثيرة — انتظر قليلاً' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  const raw = body.code

  // Same answer for every kind of failure, including a malformed one.
  const refuse = () => Response.json({ error: 'الكود غير صحيح أو منتهي' }, { status: 400 })
  if (!looksLikeCode(raw)) return refuse()

  let db
  try { db = createAdminClient() } catch { return Response.json({ error: 'الخادم غير مهيّأ' }, { status: 503 }) }

  // Count the attempt before spending it, so a code being probed shows up in
  // the admin list even when every attempt failed.
  const hash = hashCode(normaliseCode(raw))
  const { data: email, error } = await db.rpc('redeem_login_code', { p_hash: hash })
  if (error) return Response.json({ error: 'تعذّر التحقق — حاول لاحقاً' }, { status: 503 })
  if (!email) {
    await db.rpc('bump_code_attempt', { p_hash: hash }).catch(() => {})
    return refuse()
  }

  // The account has to exist before a magic link can be built for it, and the
  // students this feature is for are exactly the ones who never managed to
  // sign up. So it is created here when it is missing, confirmed outright —
  // confirming it is precisely what the broken email would have done, and an
  // unconfirmed account would be another door that will not open.
  //
  // The address comes from the redeemed row, never from the request, so this
  // can only ever create the account an admin already named.
  const { error: createErr } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  // Already registered is the ordinary case, not a failure.
  if (createErr && !/already|exists|registered/i.test(createErr.message || '')) {
    return Response.json({ error: 'تعذّر إنشاء الحساب' }, { status: 500 })
  }

  // No mail is sent; only the token is used.
  const { data, error: linkErr } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !data?.properties?.hashed_token) {
    return Response.json({ error: 'تعذّر إنشاء الجلسة' }, { status: 500 })
  }

  return Response.json({
    ok: true,
    email,
    tokenHash: data.properties.hashed_token,
  })
}
